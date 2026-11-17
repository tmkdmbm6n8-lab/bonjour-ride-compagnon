import { describe, expect, it } from "vitest";
import { secureResponse } from "@/lib/response-security";
describe("réponses HTTP privées", () => {
  it.each(["/api/rides/one", "/driver/dashboard", "/admin/users", "/rides/one", "/_serverFn/one"])(
    "interdit le cache pour %s",
    (path) => {
      const response = secureResponse(
        new Request(`https://app.example${path}`),
        new Response("private"),
      );
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    },
  );
  it("préserve le contenu et les en-têtes existants sans désactiver le cache des fichiers publics", async () => {
    const response = secureResponse(
      new Request("https://app.example/assets/app.js"),
      new Response("content", {
        headers: { "Cache-Control": "public, max-age=3600", "Content-Type": "text/javascript" },
      }),
    );
    expect(await response.text()).toBe("content");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
  });
  it("ne met jamais en cache une réponse authentifiée sur une URL différente", () => {
    const response = secureResponse(
      new Request("https://app.example/rpc", { headers: { authorization: "Bearer test" } }),
      new Response("private"),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
