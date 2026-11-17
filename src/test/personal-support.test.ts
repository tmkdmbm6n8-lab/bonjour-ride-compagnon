// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { personalSupportRequests, sendSupportMessage } from "@/lib/vtc-support.server";
import { newSupportThread } from "@/lib/vtc-support";
function admin(rows: Record<string, unknown>[]) {
  const writes = vi.fn();
  const db = {
    from: () => {
      let one = false;
      const q: Record<string, unknown> = {
        select: () => q,
        ilike: () => q,
        eq: () => q,
        like: () => q,
        order: () => q,
        range: () => q,
        single: () => {
          one = true;
          return q;
        },
        update: (value: unknown) => {
          writes(value);
          return q;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: one ? rows[0] : rows, error: null }).then(resolve),
      };
      return q;
    },
  };
  return { db, writes };
}
describe("réclamations privées client/chauffeur", () => {
  it("ne mélange pas les comptes même si une recherche renvoie des lignes étrangères", async () => {
    const row = (id: string, email: string, userId?: string) => ({
      id,
      email,
      topic: userId ? "driver_conversation" : "payments",
      message: userId ? JSON.stringify(newSupportThread(userId, "Question", "Texte")) : "Texte",
      created_at: "2026-11-17T00:00:00Z",
    });
    const { db } = admin([
      row("owned", "self@example.test"),
      row("other", "other@example.test"),
      row("forged-email", "self@example.test", "other"),
      row("old-email", "old@example.test", "self"),
    ]);
    const result = await personalSupportRequests(db, "self", "self@example.test", 0);
    expect(result.requests.map((r: { id: string }) => r.id).sort()).toEqual(["old-email", "owned"]);
  });
  it("refuse de répondre à la conversation d’un autre utilisateur", async () => {
    const { db, writes } = admin([
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        email: "other@example.test",
        topic: "payments",
        message: "Private",
      },
    ]);
    await expect(
      sendSupportMessage(db, {
        uid: "self",
        email: "self@example.test",
        name: "Self",
        role: "rider",
        body: { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", text: "hello" },
      }),
    ).rejects.toThrow(/inaccessible/);
    expect(writes).not.toHaveBeenCalled();
  });
  it("conserve correctement le rôle client dans une nouvelle conversation", () => {
    const thread = newSupportThread("self", "Question", "Bonjour", "2026-11-17T00:00:00Z", "rider");
    expect(thread.messages[0].from).toBe("rider");
  });
});
