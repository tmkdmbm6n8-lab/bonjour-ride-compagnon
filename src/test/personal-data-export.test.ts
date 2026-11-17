import { describe, expect, it, vi } from "vitest";
import {
  downloadPersonalData,
  exportPageOptions,
  PERSONAL_DATA_PAGE_SIZE,
} from "@/lib/personal-data-export";
describe("export personnel paginé", () => {
  it("récupère toutes les pages en gardant la même date limite", async () => {
    const fetcher = vi.fn(async (url: string) => {
      const p = new URL(url, "https://app").searchParams;
      if (p.get("page") === "0")
        return Response.json({
          exportedAt: "2026-11-17T00:00:00.000Z",
          account: { role: "rider" },
          rides: [{ id: "one" }],
          walletTransactions: [],
          supportRequests: [],
          pagination: { page: 0, hasMore: true },
        });
      expect(p.get("until")).toBe("2026-11-17T00:00:00.000Z");
      return Response.json({
        rides: [{ id: "two" }],
        walletTransactions: [{ id: "payment" }],
        supportRequests: [{ id: "support" }],
        pagination: { page: 1, hasMore: false },
      });
    });
    const data = await downloadPersonalData(fetcher);
    expect(data.rides).toHaveLength(2);
    expect(data.supportRequests).toHaveLength(1);
    expect(data.account.role).toBe("rider");
    expect(data.pagination).toBeUndefined();
  });
  it("n’enregistre pas un fichier partiel lorsqu’une page échoue", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          exportedAt: "2026-11-17T00:00:00Z",
          pagination: { page: 0, hasMore: true },
        }),
      )
      .mockResolvedValueOnce(Response.json({ error: "indisponible" }, { status: 503 }));
    await expect(downloadPersonalData(fetcher)).rejects.toThrow("indisponible");
  });
  it("rejette les pages invalides et les limites futures", () => {
    const now = Date.parse("2026-11-17T00:00:00Z");
    expect(exportPageOptions(new URLSearchParams({ page: "2" }), now).from).toBe(
      2 * PERSONAL_DATA_PAGE_SIZE,
    );
    for (const page of ["-1", "NaN", "1.5", "Infinity"])
      expect(() => exportPageOptions(new URLSearchParams({ page }), now)).toThrow();
    expect(() => exportPageOptions(new URLSearchParams({ until: "2030-01-01" }), now)).toThrow();
  });
});
