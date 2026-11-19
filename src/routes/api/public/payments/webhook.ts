import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

// Stripe → StrasDrive. Security comes from the signature check; no user session is involved.
// A paid Checkout Session (wallet top-up or card ride) credits the wallet once, even if the
// passenger closed the page before the return screen confirmed it.
async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.mode === "subscription") {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncGoldEvent } = await import("@/lib/driver-gold.server");
        await syncGoldEvent(supabaseAdmin, env, event);
        break;
      }
      if (session.payment_status === "paid") {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { creditPaidSession } = await import("@/lib/vtc-checkout.server");
        await creditPaidSession(supabaseAdmin, session);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { syncGoldEvent } = await import("@/lib/driver-gold.server");
      await syncGoldEvent(supabaseAdmin, env, event);
      break;
    }
    case "checkout.session.async_payment_failed":
      console.log("Card payment failed after checkout:", event.data.object?.id);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid or missing env query parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
