import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moderateMessageText } from "@/lib/message-moderation.server";
import { sendChatMessage } from "@/lib/ride-chat.server";
import { sendSupportMessage } from "@/lib/vtc-support.server";

beforeEach(() => vi.stubEnv("OPENAI_MODERATION_API_KEY", "test-key"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("modération IA avant envoi", () => {
  const text = "Personne ne supporte les gens comme toi.";

  it("bloque le chat avant toute écriture et envoie seulement le nouveau texte", async () => {
    const request = vi.fn(async () => Response.json({ results: [{ categories: { harassment: true } }] }));
    vi.stubGlobal("fetch", request);
    const db = { from: vi.fn() };
    const ride = { id: "trip", rider_id: "rider", driver_id: "driver", status: "accepted" };
    await expect(sendChatMessage(db, ride, "rider", { text })).rejects.toThrow(/Contenu inapproprié/);
    expect(db.from).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledExactlyOnceWith("https://api.openai.com/v1/moderations", expect.objectContaining({
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
      signal: expect.any(AbortSignal),
    }));
  });

  it("bloque aussi un nouveau message envoyé à l’assistance", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ results: [{ categories: { "hate/threatening": true } }] })));
    const db = { from: vi.fn() };
    await expect(sendSupportMessage(db, {
      uid: "rider", email: "rider@example.test", name: "Client", role: "rider", body: { text },
    })).rejects.toThrow(/Contenu inapproprié/);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("laisse un signalement parler de violence sans bloquer sur cette seule catégorie", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ results: [{ flagged: true, categories: { violence: true } }] })));
    await expect(moderateMessageText("Le chauffeur a été agressé.")).resolves.toBeUndefined();
  });

  it("revient au filtre local si l’API est indisponible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Timeout")));
    await expect(moderateMessageText("Je suis devant la gare.")).resolves.toBeUndefined();
  });

  it("ne contacte pas l’API sans clé", async () => {
    vi.stubEnv("OPENAI_MODERATION_API_KEY", "");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await moderateMessageText("Je suis devant la gare.");
    expect(request).not.toHaveBeenCalled();
  });
});
