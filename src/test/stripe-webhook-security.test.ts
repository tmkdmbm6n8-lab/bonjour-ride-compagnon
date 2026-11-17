import { webcrypto, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyWebhook } from "@/lib/stripe.server";
const secret = "whsec_unit_test_only";
const now = Date.parse("2026-11-17T12:00:00Z");
const event = {
  id: "evt_test",
  type: "checkout.session.completed",
  livemode: false,
  data: { object: { id: "cs_test", payment_status: "paid" } },
};
function request(
  body = JSON.stringify(event),
  timestamp = String(now / 1000),
  key = secret,
  signature?: string,
) {
  const hash = createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
  return new Request("https://app.example/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    headers: { "stripe-signature": signature || `t=${timestamp},v1=${hash}` },
    body,
  });
}
beforeEach(() => {
  vi.stubEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET", secret);
  vi.stubEnv("PAYMENTS_LIVE_WEBHOOK_SECRET", "live_unit_test");
  vi.stubGlobal("crypto", webcrypto);
  vi.spyOn(Date, "now").mockReturnValue(now);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("signature webhook sans appel financier réel", () => {
  it("accepte un événement signé et frais", async () => {
    expect(await verifyWebhook(request(), "sandbox")).toMatchObject({ id: "evt_test" });
  });
  it("refuse les données modifiées après signature", async () => {
    const signed = request();
    const signature = signed.headers.get("stripe-signature")!;
    await expect(
      verifyWebhook(
        request(JSON.stringify({ ...event, type: "other" }), undefined, undefined, signature),
        "sandbox",
      ),
    ).rejects.toThrow(/signature/);
  });
  it("refuse les signatures périmées et les dates non numériques", async () => {
    await expect(
      verifyWebhook(request(undefined, String(now / 1000 - 301)), "sandbox"),
    ).rejects.toThrow(/old/);
    await expect(verifyWebhook(request(undefined, "NaN"), "sandbox")).rejects.toThrow(/format/);
  });
  it("gère la rotation des secrets sans accepter une signature arbitraire", async () => {
    const signature = request().headers.get("stripe-signature")!;
    expect(
      await verifyWebhook(
        request(undefined, undefined, undefined, signature + ",v1=" + "0".repeat(64)),
        "sandbox",
      ),
    ).toMatchObject({ id: "evt_test" });
    await expect(
      verifyWebhook(request(undefined, undefined, "wrong"), "sandbox"),
    ).rejects.toThrow();
  });
  it("sépare les événements test et production", async () => {
    await expect(
      verifyWebhook(request(JSON.stringify({ ...event, livemode: true })), "sandbox"),
    ).rejects.toThrow(/environment/);
  });
});
