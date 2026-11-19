import { createStripeClient } from "./stripe.server";
import { GOLD_MONTHLY_CENTS, GOLD_TRIAL_DAYS, goldEntitlement } from "./driver-gold";

const KIND = "strasdrive_gold";
const TABLE = "driver_gold_subscriptions";
const allowedStatuses = new Set(["trialing", "active", "past_due", "canceled"]);
const terminal = new Set(["canceled", "incomplete_expired"]);
const objectId = (object) => typeof object === "string" ? object : object?.id;
const iso = (seconds) => Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;

function required({ data, error }) {
  if (error) throw new Error("Le suivi StrasDrive Gold est indisponible.");
  return data;
}

function billingEnv() {
  const env = process.env.GOLD_STRIPE_ENV;
  return env === "live" || env === "sandbox" ? env : null;
}

function billingRow(admin, driverId, env) {
  return admin.from(TABLE).select("*").eq("driver_id", driverId).eq("environment", env);
}

export async function driverGold(admin, driver) {
  const env = billingEnv();
  if (!driver) return goldEntitlement(driver, null);
  if (!env) return { ...goldEntitlement(driver, null), unavailable: !driver.is_priority };
  const result = await billingRow(admin, driver.user_id, env).maybeSingle();
  if (result.error) return { ...goldEntitlement(driver, null), unavailable: !driver.is_priority };
  return goldEntitlement(driver, result.data);
}

export async function loadDriverGold(admin, driverId) {
  const driver = required(await admin.from("drivers").select("user_id,is_priority").eq("user_id", driverId).single());
  return driverGold(admin, driver);
}

async function goldSubscriptions(stripe, customer) {
  const subscriptions = [];
  for await (const subscription of stripe.subscriptions.list({ customer, status: "all", expand: ["data.latest_invoice"] })) {
    if (subscription.metadata?.kind === KIND) subscriptions.push(subscription);
  }
  return subscriptions;
}

async function syncBilling(admin, stripe, owner) {
  // Read before querying Stripe, then compare-and-set. A webhook racing with another
  // snapshot must read Stripe again, even if the events share the same timestamp.
  for (let attempt = 0; attempt < 5; attempt++) {
    const query = () => billingRow(admin, owner.driver_id, owner.environment);
    const row = required(await query().maybeSingle());
    if (!row || row.stripe_customer_id !== owner.stripe_customer_id) return null;
    const subscriptions = await goldSubscriptions(stripe, row.stripe_customer_id);
    const current = subscriptions.find((subscription) => !terminal.has(subscription.status));
    const latest = current || subscriptions[0];
    const item = latest?.items?.data?.find(({ price }) =>
      price.unit_amount === GOLD_MONTHLY_CENTS && price.currency === "eur" &&
      ["inclusive", "unspecified"].includes(price.tax_behavior) && price.recurring?.interval === "month" && price.recurring.interval_count === 1);
    const invoice = latest?.latest_invoice;
    const failedCollection = invoice?.collection_method === "charge_automatically" &&
      invoice.status === "open" && invoice.attempt_count > 0 && invoice.amount_remaining > 0;
    const status = item && allowedStatuses.has(latest.status)
      ? latest.status === "active" && failedCollection ? "past_due" : latest.status
      : "inactive";
    const updated = required(await admin.from(TABLE).update({
      revision: row.revision + 1,
      gold_status: status,
      gold_trial_ends_at: iso(latest?.trial_end),
      gold_current_period_end: iso(item?.current_period_end),
      stripe_subscription_id: latest?.id || null,
      trial_used: row.trial_used || subscriptions.some(({ trial_start }) => trial_start != null),
      can_manage: Boolean(current),
      cancel_at_period_end: Boolean(latest?.cancel_at_period_end),
    }).eq("driver_id", row.driver_id).eq("environment", row.environment)
      .eq("revision", row.revision).select("*").maybeSingle());
    if (updated) return updated;
  }
  throw new Error("La synchronisation StrasDrive Gold doit être relancée.");
}

export async function syncGoldEvent(admin, env, event) {
  if (env !== billingEnv()) return;
  const object = event.data.object;
  // A paid Gold Checkout never enters the wallet-credit path.
  if (object.object === "checkout.session" && (object.mode !== "subscription" || object.metadata?.kind !== KIND)) return;
  const customer = objectId(object.customer);
  if (!customer) return;
  const owner = required(await admin.from(TABLE).select("driver_id,environment,stripe_customer_id")
    .eq("environment", env).eq("stripe_customer_id", customer).maybeSingle());
  if (owner) await syncBilling(admin, createStripeClient(env), owner);
}

export async function openGoldBilling(admin, driverId, manage = false) {
  const driver = required(await admin.from("drivers").select("user_id,is_priority,is_approved").eq("user_id", driverId).single());
  if (driver.is_priority && !manage) throw new Error("StrasDrive Gold est déjà inclus pour votre compte.");
  if (!driver.is_approved && !manage) throw new Error("Votre compte chauffeur doit être approuvé.");
  const env = billingEnv();
  const base = process.env.APP_URL;
  const priceId = process.env.GOLD_STRIPE_PRICE_ID || "strasdrive_gold_monthly";
  if (!env || !base || !priceId) throw new Error("Les abonnements StrasDrive Gold ne sont pas encore disponibles.");
  const returnUrl = new URL("/driver/private-clients", base).href;
  const stripe = createStripeClient(env);

  let owner = required(await billingRow(admin, driverId, env).maybeSingle());
  if (!owner && !manage) {
    const customer = await stripe.customers.create({
      metadata: { kind: KIND, driverId },
    }, { idempotencyKey: `${KIND}:customer:${env}:${driverId}` });
    required(await admin.from(TABLE).upsert({
      driver_id: driverId, environment: env, stripe_customer_id: customer.id,
    }, { onConflict: "driver_id,environment", ignoreDuplicates: true }));
    owner = required(await billingRow(admin, driverId, env).single());
  }
  if (!owner) throw new Error("Aucun compte de facturation StrasDrive Gold.");

  const customer = owner.stripe_customer_id;
  const { data: [lastSession] } = await stripe.checkout.sessions.list({ customer, limit: 1 });
  const billing = await syncBilling(admin, stripe, owner);
  if (!billing) throw new Error("Compte de facturation StrasDrive Gold introuvable.");
  const checkoutSubscription = lastSession?.status === "complete" && objectId(lastSession.subscription);
  const hasPendingSubscription = checkoutSubscription && checkoutSubscription !== billing.stripe_subscription_id &&
    !terminal.has((await stripe.subscriptions.retrieve(checkoutSubscription)).status);
  if (manage || billing.can_manage || hasPendingSubscription) {
    const portal = await stripe.billingPortal.sessions.create({ customer, return_url: returnUrl });
    return { url: portal.url };
  }

  if (lastSession?.status === "open" && lastSession.url) return { url: lastSession.url };
  const price = priceId.startsWith("price_")
    ? await stripe.prices.retrieve(priceId)
    : (await stripe.prices.list({ lookup_keys: [priceId], active: true, limit: 1 })).data[0];
  if (!price) throw new Error("Le tarif StrasDrive Gold n’est pas correctement configuré.");
  if (!price.active || price.unit_amount !== GOLD_MONTHLY_CENTS || price.currency !== "eur" ||
      !["inclusive", "unspecified"].includes(price.tax_behavior) || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) {
    throw new Error("Le tarif StrasDrive Gold n’est pas correctement configuré.");
  }
  const metadata = { kind: KIND, driverId };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: price.id, quantity: 1 }],
    payment_method_collection: billing.trial_used ? "always" : "if_required",
    subscription_data: {
      metadata,
      ...(!billing.trial_used && {
        trial_period_days: GOLD_TRIAL_DAYS,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      }),
    },
    metadata,
    success_url: `${returnUrl}?gold=return`,
    cancel_url: returnUrl,
  }, { idempotencyKey: `${KIND}:checkout:${customer}:${lastSession?.id || "initial"}` });
  return { url: session.url };
}

// Gold uses a dedicated customer. Deleting it in Stripe stops its subscriptions before
// the account erasure RPC cascades the local billing link.
export async function closeGoldBillingForDeletedAccount(admin, driverId) {
  const result = await admin.from(TABLE).select("environment,stripe_customer_id").eq("driver_id", driverId);
  if (["42P01", "PGRST205"].includes(result.error?.code)) return;
  for (const row of required(result)) {
    const stripe = createStripeClient(row.environment);
    const customer = await stripe.customers.retrieve(row.stripe_customer_id);
    if (!customer.deleted) await stripe.customers.del(customer.id);
  }
}
