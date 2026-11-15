import { useMemo } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";

/**
 * Stripe's secure card form, shown inside the app.
 * `fetchClientSecret` must be stable for the lifetime of the form (mount a new one with a new `key`).
 */
export default function EmbeddedPayment({ fetchClientSecret, onComplete }) {
  const options = useMemo(() => ({ fetchClientSecret, onComplete }), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div id="checkout" style={{ minHeight: 360 }}>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
