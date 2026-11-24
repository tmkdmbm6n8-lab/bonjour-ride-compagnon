import { describe, expect, it, vi } from "vitest";
import { sendChatMessage } from "@/lib/ride-chat.server";
import { sendSupportMessage } from "@/lib/vtc-support.server";
import { newChatMessage } from "@/lib/ride-chat";

describe("filtre des insultes", () => {
  it.each(["Quel CONNARD !", "Tu es un bâtard.", "Fils-de-pute !", "c\u200bonnasse"])(
    "rejette le message avant tout accès aux messages de la course",
    async (text) => {
      const db = { from: vi.fn() };
      await expect(sendChatMessage(db, { id: "ride", rider_id: "rider" }, "rider", { text }))
        .rejects.toThrow(/Contenu inapproprié/);
      expect(db.from).not.toHaveBeenCalled();
    },
  );

  it.each([
    { text: "Espèce de connard" },
    { id: "00000000-0000-0000-0000-000000000000", text: "Espèce de connard" },
    { subject: "Connard", text: "Bonjour" },
  ])("rejette aussi un envoi à l’assistance avant toute écriture", async (body) => {
    const db = { from: vi.fn() };
    await expect(sendSupportMessage(db, {
      uid: "rider", email: "rider@example.test", name: "Client", role: "rider", body,
    })).rejects.toThrow(/Contenu inapproprié/);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("laisse passer les mots courants qui contiennent les mêmes lettres", () => {
    const text = "Bonjour, je suis devant la consigne. Le conducteur connaît le passage.";
    expect(newChatMessage({ text }, "rider").text).toBe(text);
  });
});
