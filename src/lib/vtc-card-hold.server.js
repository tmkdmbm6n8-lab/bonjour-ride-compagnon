import { createStripeClient } from './stripe.server';
import { resolveOrCreateCustomer } from './vtc-checkout.server';

function stripeClient() {
  const env = process.env.PAYMENTS_STRIPE_ENV;
  if (env !== 'sandbox' && env !== 'live') throw new Error('Environnement Stripe non configuré');
  return createStripeClient(env);
}
function cents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100 && Math.abs(Math.round(amount * 100) - amount * 100) > 1e-7)
    throw new Error('Montant en euros invalide');
  const result = Math.round(amount * 100);
  if (!Number.isSafeInteger(result)) throw new Error('Montant trop élevé');
  return result;
}
function requiredId(value, name) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,150}$/.test(value)) throw new Error(name + ' invalide');
  return value;
}

/** Prépare l'enregistrement d'une carte sans prélèvement. Le client doit confirmer le SetupIntent côté Stripe. */
export async function createCardSetupIntent(admin, { userId, email }) {
  requiredId(userId, 'Utilisateur');
  const stripe = stripeClient();
  const customerId = await resolveOrCreateCustomer(stripe, { userId, email });
  const intent = await stripe.setupIntents.create({
    customer: customerId, payment_method_types: ['card'], usage: 'off_session',
    metadata: { userId },
  }, { idempotencyKey: `card-setup-${userId}-${crypto.randomUUID()}` });
  return { clientSecret: intent.client_secret, customerId };
}

/** N'enregistre que les métadonnées d'une carte confirmée et appartenant à ce client Stripe. */
export async function saveRiderCard(admin, { userId, paymentMethodId, isDefault = false }) {
  requiredId(userId, 'Utilisateur');
  requiredId(paymentMethodId, 'Moyen de paiement');
  const stripe = stripeClient();
  const customerId = await resolveOrCreateCustomer(stripe, { userId });
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.type !== 'card' || pm.customer !== customerId) throw new Error('Cette carte ne correspond pas au client');
  const setups = await stripe.setupIntents.list({ customer: customerId, payment_method: paymentMethodId, limit: 10 });
  if (!setups.data.some(intent => intent.status === 'succeeded' && intent.usage === 'off_session'))
    throw new Error('Carte non confirmée pour les paiements futurs');
  // Default flag changes must be atomic in the database to avoid two default cards.
  const { data, error } = await admin.from('rider_payment_methods').upsert({
    user_id: userId, stripe_payment_method_id: pm.id,
    brand: pm.card.brand, last4: pm.card.last4,
    exp_month: pm.card.exp_month, exp_year: pm.card.exp_year,
    is_default: Boolean(isDefault),
  }, { onConflict: 'stripe_payment_method_id' }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

/** Réserve les fonds sans encaisser. Ne doit être appelé qu'après vérification serveur du prix et de la course. */
export async function holdRideFare(admin, { userId, rideId, fareEuros, paymentMethodId }) {
  requiredId(userId, 'Utilisateur');
  requiredId(rideId, 'Course');
  requiredId(paymentMethodId, 'Moyen de paiement');
  const stripe = stripeClient();
  const customerId = await resolveOrCreateCustomer(stripe, { userId });
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== customerId || pm.type !== 'card') throw new Error('Carte non autorisée');
  const intent = await stripe.paymentIntents.create({
    amount: cents(fareEuros), currency: 'eur', customer: customerId,
    payment_method: paymentMethodId, capture_method: 'manual',
    confirm: true, off_session: true,
    metadata: { ride_id: rideId, user_id: userId, type: 'ride_hold' },
    description: `StrasDrive — Empreinte course ${rideId}`,
  }, { idempotencyKey: `ride-hold-${rideId}` });
  return { intentId: intent.id, status: intent.status };
}

/** Encaisse au maximum le montant encore autorisé. Appel réservé au serveur après contrôle de la course. */
export async function captureRideFare(admin, { paymentIntentId, finalFareEuros }) {
  requiredId(paymentIntentId, 'Empreinte');
  const stripe = stripeClient();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const captureAmount = cents(finalFareEuros);
  if (intent.status !== 'requires_capture') throw new Error('Empreinte non capturable');
  if (captureAmount > intent.amount_capturable) throw new Error('Montant final supérieur à l’autorisation bancaire');
  const captured = await stripe.paymentIntents.capture(paymentIntentId, {
    amount_to_capture: captureAmount,
  }, { idempotencyKey: `ride-capture-${paymentIntentId}` });
  return { intentId: captured.id, status: captured.status, amountCaptured: captured.amount_received / 100 };
}

/** Annule l'empreinte ; le délai de libération des fonds dépend de la banque. */
export async function cancelRideHold(admin, { paymentIntentId }) {
  requiredId(paymentIntentId, 'Empreinte');
  const stripe = stripeClient();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status === 'canceled') return { intentId: intent.id, status: intent.status };
  if (intent.status !== 'requires_capture') throw new Error('Empreinte non annulable');
  const canceled = await stripe.paymentIntents.cancel(paymentIntentId, {}, {
    idempotencyKey: `ride-cancel-${paymentIntentId}`,
  });
  return { intentId: canceled.id, status: canceled.status };
}
