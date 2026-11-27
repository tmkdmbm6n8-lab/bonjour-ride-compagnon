import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  handleVtc: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/vtc.server", () => ({ handleVtc: mocks.handleVtc }));

import { handleNativeApiRequest, nativeBusinessPath } from "@/lib/native-api.server";

const token = "header.payload.signature";
const url = "https://strasdrive.fr/api/public/native/users/me/live";

function authenticatedRequest(path = url, init: RequestInit = {}): Request {
  return new Request(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://backend.example");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  mocks.createClient.mockReturnValue({ auth: { getClaims: mocks.getClaims } });
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", email: "user@example.test" } }, error: null });
  mocks.handleVtc.mockResolvedValue({ role: "rider", canDrive: false, suspended: false });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("passerelle de l’application native", () => {
  it("refuse toute lecture métier sans jeton de session", async () => {
    const response = await handleNativeApiRequest(new Request(url));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "SESSION_EXPIRED" });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.handleVtc).not.toHaveBeenCalled();
  });

  it("refuse un jeton rejeté par le service d’authentification", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: new Error("invalid") });
    const response = await handleNativeApiRequest(authenticatedRequest());
    expect(response.status).toBe(401);
    expect(mocks.handleVtc).not.toHaveBeenCalled();
  });

  it("transmet l’identité vérifiée, la route et les paramètres au gestionnaire existant", async () => {
    const response = await handleNativeApiRequest(authenticatedRequest(`${url}?view=rider`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.handleVtc).toHaveBeenCalledWith(
      { path: "/api/users/me/live?view=rider", method: "GET", body: {} },
      expect.objectContaining({ userId: "user-1" }),
    );
    const clientOptions = mocks.createClient.mock.calls[0]?.[2];
    expect(clientOptions?.global?.headers?.Authorization).toBe(`Bearer ${token}`);
    expect(mocks.getClaims).toHaveBeenCalledWith(token);
  });

  it("transmet un objet JSON sans autoriser un corps arbitraire", async () => {
    mocks.handleVtc.mockResolvedValue({ ignored: true });
    const response = await handleNativeApiRequest(authenticatedRequest(
      "https://strasdrive.fr/api/public/native/drivers/location",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: 48.58, lng: 7.75 }),
      },
    ));
    expect(response.status).toBe(200);
    expect(mocks.handleVtc).toHaveBeenCalledWith(
      { path: "/api/drivers/location", method: "POST", body: { lat: 48.58, lng: 7.75 } },
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("refuse un JSON mal formé avant tout appel métier", async () => {
    const response = await handleNativeApiRequest(authenticatedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{broken",
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_JSON" });
    expect(mocks.handleVtc).not.toHaveBeenCalled();
  });

  it("préserve le refus d’accès et la suspension décidés par les règles métier", async () => {
    mocks.handleVtc.mockRejectedValueOnce(new Error("Accès administrateur requis"));
    expect((await handleNativeApiRequest(authenticatedRequest())).status).toBe(403);
    mocks.handleVtc.mockRejectedValueOnce(new Error("DRIVER_SUSPENDED"));
    const suspended = await handleNativeApiRequest(authenticatedRequest());
    expect(suspended.status).toBe(403);
    expect(await suspended.json()).toMatchObject({ code: "DRIVER_SUSPENDED" });
  });

  it("répond au contrôle réseau préalable sans ouvrir de session", async () => {
    const response = await handleNativeApiRequest(new Request(url, { method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("conserve les paramètres et bloque les chemins ambigus", () => {
    expect(nativeBusinessPath(`${url}?view=rider`)).toBe("/api/users/me/live?view=rider");
    expect(() => nativeBusinessPath("https://strasdrive.fr/api/public/native/users/../admin/users")).toThrow();
    expect(() => nativeBusinessPath("https://strasdrive.fr/api/public/native/users/%2e%2e/admin")).toThrow();
  });
});

