import { createStripeClient, getStripeErrorMessage } from "./stripe.server";
import { topupAmountProblem, toCents, isStripeEnv, cardBookingExpired, safeOrigin } from "./vtc-checkout";
import { VEHICLE_CLASS_LABELS } from "./vtc-checkout-labels";

// Looks up the Stripe Customer by userId metadata (then email), or creates one, so later reads stay searchable.
async function resolveOrCreateCustomer(stripe, options) {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  if (options.userId) {
    const found = await stripe.customers.search({ query: `metadata['userId']:'${options.userId}'`, limit: 1 });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, { metadata: { ...customer.metadata, userId: options.userId } });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

/** Credits the paid amount of a Checkout Session to its user's wallet. Idempotent per session (webhook + return page). */
export async function creditPaidSession(admin, session) {
  const userId = session?.metadata?.userId;
  if (!userId || session.payment_status !== "paid" || !session.amount_total) return false;
  const { error } = await admin.rpc("wallet_entry", {
    _user: userId,
    _amount: session.amount_total / 100,
    _type: "topup",
    _provider: session.id,
  });
  if (error) throw new Error("Le paiement a été reçu mais doit être réconcilié — contactez le support");
  return true;
}

function embeddedSession(stripe, { uid, customer, amount, name, returnUrl, metadata }) {
  return stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "embedded_page",
    redirect_on_completion: "if_required",
    return_url: returnUrl,
    customer,
    client_reference_id: uid,
    line_items: [{ price_data: { currency: "eur", unit_amount: toCents(amount), product_data: { name } }, quantity: 1 }],
    payment_intent_data: { description: name, metadata },
    metadata,
  });
}

/**
 * Card payments: wallet top-up (free amount) and ride paid by card at booking.
 * A card ride credits the exact fare to the wallet, then the ride is booked with that fare and settled from the wallet.
 */
export async function handleCheckout({ admin, uid, role, email, p, q, method, body, createRide, quoteRide, serializeRide }) {
  const env = method === "GET" ? q.get("env") : body.environment;
  if (!isStripeEnv(env)) throw new Error("Paiement par carte indisponible pour le moment");
  let stripe;
  try {
    stripe = createStripeClient(env);
  } catch {
    throw new Error("Le paiement par carte n’est pas encore activé");
  }
  try {
    if (p === "/api/wallet/checkout" && method === "POST") {
      const problem = topupAmountProblem(body.amount);
      if (problem) return { error: problem };
      const origin = safeOrigin(body.origin);
      if (!origin) return { error: "Adresse de retour invalide" };
      const customer = await resolveOrCreateCustomer(stripe, { email, userId: uid });
      const metadata = { userId: uid, kind: "topup" };
      const session = await embeddedSession(stripe, {
        uid, customer, amount: Number(body.amount), metadata,
        name: "Recharge du portefeuille StrasDrive",
        returnUrl: `${origin}${role === "driver" ? "/driver" : ""}/wallet?session_id={CHECKOUT_SESSION_ID}`,
      });
      return { clientSecret: session.client_secret, sessionId: session.id };
    }
    if (p === "/api/wallet/checkout") {
      const session = await stripe.checkout.sessions.retrieve(String(q.get("session_id") || ""));
      if (session.metadata?.userId !== uid) return { error: "Paiement inaccessible" };
      if (session.payment_status !== "paid") return { paid: false };
      await creditPaidSession(admin, session);
      return { paid: true, credited: true, amount: session.amount_total / 100 };
    }
    if (p === "/api/rides/card-checkout") {
      if (role !== "rider") return { error: "Seuls les clients peuvent réserver" };
      const origin = safeOrigin(body.origin);
      if (!origin) return { error: "Adresse de retour invalide" };
      const { fare, route } = await quoteRide(body);
      const { data: booking, error } = await admin
        .from("card_bookings")
        .insert({ rider_id: uid, vehicle_type: body.vehicleType, pickup: body.pickup, dropoff: body.dropoff, route, fare, environment: env })
        .select("id")
        .single();
      if (error) return { error: "La réservation n’a pas pu être préparée" };
      const customer = await resolveOrCreateCustomer(stripe, { email, userId: uid });
      const metadata = { userId: uid, kind: "ride", bookingId: booking.id };
      const session = await embeddedSession(stripe, {
        uid, customer, amount: fare.total, metadata,
        name: `Course StrasDrive ${VEHICLE_CLASS_LABELS[body.vehicleType] || ""}`.trim(),
        returnUrl: `${origin}/dashboard?card_session={CHECKOUT_SESSION_ID}`,
      });
      await admin.from("card_bookings").update({ stripe_session_id: session.id }).eq("id", booking.id);
      return { clientSecret: session.client_secret, sessionId: session.id, amount: fare.total };
    }
    if (p === "/api/rides/card-confirm") {
      const session = await stripe.checkout.sessions.retrieve(String(body.sessionId || ""));
      if (session.metadata?.userId !== uid || session.metadata?.kind !== "ride") return { error: "Paiement inaccessible" };
      if (session.payment_status !== "paid") return { paid: false };
      await creditPaidSession(admin, session);
      const { data: booking } = await admin
        .from("card_bookings").select("*").eq("id", session.metadata.bookingId).eq("rider_id", uid).maybeSingle();
      if (!booking) return { paid: true, booked: false };
      if (booking.ride_id) return { paid: true, booked: true, ride: await serializeRide(booking.ride_id) };
      if (booking.status !== "pending") return { paid: true, booked: booking.status === "booking" };
      if (cardBookingExpired(booking.created_at)) {
        await admin.from("card_bookings").update({ status: "expired" }).eq("id", booking.id).eq("status", "pending");
        return { paid: true, booked: false, expired: true };
      }
      // Only one confirmation (return page or callback) may create the ride.
      const { data: claimed } = await admin
        .from("card_bookings").update({ status: "booking" }).eq("id", booking.id).eq("status", "pending").select("id");
      if (!claimed?.length) return { paid: true, booked: true };
      try {
        const ride = await createRide({
          vehicleType: booking.vehicle_type, pickup: booking.pickup, dropoff: booking.dropoff,
          route: booking.route, fare: booking.fare, payment: { method: "card", stripeSessionId: session.id },
        });
        await admin.from("card_bookings").update({ status: "booked", ride_id: ride.id }).eq("id", booking.id);
        return { paid: true, booked: true, ride };
      } catch (e) {
        await admin.from("card_bookings").update({ status: "pending" }).eq("id", booking.id);
        return { error: `${e?.message || "La course n’a pas pu être créée"} — le montant payé est sur votre portefeuille` };
      }
    }
  } catch (error) {
    return { error: getStripeErrorMessage(error) };
  }
  throw new Error("Action de paiement inconnue");
}
