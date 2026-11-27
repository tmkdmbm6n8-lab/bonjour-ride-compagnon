import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const NATIVE_API_PREFIX = "/api/public/native";
const MAX_BODY_LENGTH = 100_000;
const tokenSchema = z
  .string()
  .min(3)
  .max(8192)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
const bodySchema = z.record(z.string(), z.unknown());

export class NativeApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "NativeApiError";
  }
}

function nativeHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "private, no-store",
    Vary: "Authorization",
  });
}

function jsonResponse(value: unknown, status = 200, code?: string): Response {
  const headers = nativeHeaders();
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (status === 405) headers.set("Allow", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  const payload = typeof value === "object" && value !== null && code
    ? { ...(value as Record<string, unknown>), code }
    : value;
  return new Response(JSON.stringify(payload), { status, headers });
}

export function nativeBusinessPath(rawUrl: string): string {
  const rawPath = rawUrl.split(/[?#]/, 1)[0] || "";
  if (/(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath) || /%(?:2e|2f|5c)/i.test(rawPath)) {
    throw new NativeApiError(400, "Adresse API invalide", "INVALID_PATH");
  }
  const url = new URL(rawUrl);
  if (!url.pathname.startsWith(`${NATIVE_API_PREFIX}/`)) {
    throw new NativeApiError(404, "Service natif introuvable", "NOT_FOUND");
  }
  const suffix = url.pathname.slice(NATIVE_API_PREFIX.length);
  if (suffix.length > 1800 || url.search.length > 2048 || suffix.includes("\\") || suffix.includes("//")) {
    throw new NativeApiError(400, "Adresse API invalide", "INVALID_PATH");
  }
  for (const segment of suffix.split("/")) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw new NativeApiError(400, "Adresse API invalide", "INVALID_PATH");
    }
    if (decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\") || decoded.includes("\0")) {
      throw new NativeApiError(400, "Adresse API invalide", "INVALID_PATH");
    }
  }
  return `/api${suffix}${url.search}`;
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

async function authenticate(request: Request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") || "");
  const parsedToken = tokenSchema.safeParse(match?.[1] || "");
  if (!parsedToken.success) {
    throw new NativeApiError(401, "Votre session a expiré : reconnectez-vous", "SESSION_EXPIRED");
  }
  const token = parsedToken.data;
  const supabaseUrl = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !publishableKey) {
    throw new NativeApiError(503, "Le service de connexion est momentanément indisponible", "AUTH_UNAVAILABLE");
  }
  const supabase = createClient<Database>(supabaseUrl, publishableKey, {
    global: {
      fetch: createSupabaseFetch(publishableKey),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims || typeof data.claims.sub !== "string" || !data.claims.sub) {
    throw new NativeApiError(401, "Votre session a expiré : reconnectez-vous", "SESSION_EXPIRED");
  }
  return { supabase, userId: data.claims.sub, claims: data.claims };
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (request.method === "GET") return {};
  const raw = await request.text();
  if (!raw) return {};
  if (raw.length > MAX_BODY_LENGTH) {
    throw new NativeApiError(413, "La requête est trop volumineuse", "BODY_TOO_LARGE");
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new NativeApiError(415, "Le contenu doit être envoyé en JSON", "JSON_REQUIRED");
  }
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new NativeApiError(400, "Le JSON envoyé est invalide", "INVALID_JSON");
  }
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    throw new NativeApiError(400, "Le contenu JSON doit être un objet", "INVALID_BODY");
  }
  return parsed.data;
}

function businessFailure(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Une erreur est survenue";
  if (message === "DRIVER_SUSPENDED") {
    return jsonResponse({ error: "Votre accès chauffeur est suspendu. Contactez l’assistance." }, 403, "DRIVER_SUSPENDED");
  }
  if (/ACCOUNT_UNAVAILABLE|unauthori[sz]ed|authorization header|jwt/i.test(message)) {
    return jsonResponse({ error: "Votre session a expiré : reconnectez-vous" }, 401, "SESSION_EXPIRED");
  }
  if (/Accès .* requis/i.test(message)) return jsonResponse({ error: message }, 403, "FORBIDDEN");
  if (/Méthode non autorisée/i.test(message)) {
    return jsonResponse({ error: message }, 405, "METHOD_NOT_ALLOWED");
  }
  if (/Ce service n’est pas encore disponible/i.test(message)) {
    return jsonResponse({ error: message }, 404, "NOT_FOUND");
  }
  return jsonResponse({ error: message }, 400);
}

export async function handleNativeApiRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: nativeHeaders() });
  try {
    const context = await authenticate(request);
    const path = nativeBusinessPath(request.url);
    const body = await jsonBody(request);
    const { handleVtc } = await import("./vtc.server");
    const result = await handleVtc({ path, method: request.method, body }, context);
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof NativeApiError) {
      return jsonResponse({ error: error.message }, error.status, error.code);
    }
    return businessFailure(error);
  }
}
