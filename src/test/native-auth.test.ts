import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), signInWithPassword: vi.fn(), refreshSession: vi.fn(), handleVtc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/vtc.server", () => ({ handleVtc: mocks.handleVtc }));
import { handleNativeApiRequest } from "@/lib/native-api.server";

function request(action: string, body: unknown, method = "POST") {
  return new Request(`https://strasdrive.fr/api/public/native/auth/${action}`, {
    method, headers: { "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}
const success = { data: { session: { user: { id: "account-1" }, access_token: "access-test", refresh_token: "refresh-test", expires_at: 1800000000 } }, error: null };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://backend.example");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  mocks.createClient.mockReturnValue({ auth: { signInWithPassword: mocks.signInWithPassword, refreshSession: mocks.refreshSession } });
  mocks.signInWithPassword.mockResolvedValue(success);
  mocks.refreshSession.mockResolvedValue(success);
});
afterEach(() => vi.unstubAllEnvs());

describe("connexion native", () => {
  it("connecte sans bearer et renvoie la session avec expiration en millisecondes", async () => {
    const response = await handleNativeApiRequest(request("login", { email: " driver@example.test ", password: "password-test" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accountId: "account-1", accessToken: "access-test", refreshToken: "refresh-test", expiresAt: 1800000000000 });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "driver@example.test", password: "password-test" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.handleVtc).not.toHaveBeenCalled();
  });
  it("renouvelle sans access token et transmet le refresh token au service de connexion", async () => {
    const response = await handleNativeApiRequest(request("refresh", { refreshToken: "old-refresh" }));
    expect(response.status).toBe(200);
    expect(mocks.refreshSession).toHaveBeenCalledWith({ refresh_token: "old-refresh" });
    expect(await response.json()).toMatchObject({ refreshToken: "refresh-test", accountId: "account-1" });
  });
  it("refuse les identifiants invalides sans exposer l’erreur du fournisseur", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { status: 400, message: "private details" } });
    const response = await handleNativeApiRequest(request("login", { email: "driver@example.test", password: "wrong" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "E-mail ou mot de passe incorrect", code: "INVALID_CREDENTIALS" });
  });
  it("refuse un refresh token expiré", async () => {
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: { status: 400 } });
    const response = await handleNativeApiRequest(request("refresh", { refreshToken: "expired" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "SESSION_EXPIRED" });
  });
  it("valide e-mail, champs supplémentaires et jeton manquant avant authentification", async () => {
    for (const [action, body] of [["login", { email: "bad", password: "p" }], ["login", { email: "a@example.test", password: "p", role: "admin" }], ["refresh", {}]] as const) {
      expect((await handleNativeApiRequest(request(action, body))).status).toBe(400);
    }
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("n’ouvre aucune autre route auth sans bearer", async () => {
    expect((await handleNativeApiRequest(request("signup", {}))).status).toBe(401);
    expect(mocks.handleVtc).not.toHaveBeenCalled();
  });
  it("refuse GET sur connexion", async () => {
    const response = await handleNativeApiRequest(request("login", {}, "GET"));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST, OPTIONS");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("conserve les limites du service d’authentification", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: { status: 429 } });
    const response = await handleNativeApiRequest(request("login", { email: "a@example.test", password: "p" }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "AUTH_RATE_LIMITED" });
  });
  it("masque les erreurs réseau et ne renvoie jamais une session partielle", async () => {
    mocks.refreshSession.mockRejectedValueOnce(new Error("private connection failure"));
    const failed = await handleNativeApiRequest(request("refresh", { refreshToken: "token" }));
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: "Le service de connexion est momentanément indisponible", code: "AUTH_UNAVAILABLE" });
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
    expect((await handleNativeApiRequest(request("refresh", { refreshToken: "token" }))).status).toBe(503);
  });
});