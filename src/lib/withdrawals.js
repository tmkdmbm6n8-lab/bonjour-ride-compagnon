export const MIN_WITHDRAWAL = 10;
export const STRIPE_INSTANT_RATE = 0.01; // Hypothèse tarifaire à confirmer auprès de Stripe
export const STRASDRIVE_MARGIN = 0.50;
export const MIN_WITHDRAWAL_FEE = 1.00;

export function calculateWithdrawalFee(debitEuros) {
  const stripeShare = Math.max(0.50, Math.round(debitEuros * STRIPE_INSTANT_RATE * 100) / 100);
  return Math.max(MIN_WITHDRAWAL_FEE, Math.round((stripeShare + STRASDRIVE_MARGIN) * 100) / 100);
}

export function withdrawalQuote(value, balance) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Indiquez un montant avec deux décimales au maximum.');
  const debitCents = Math.round(Number(text) * 100);
  const debitEuros = debitCents / 100;
  if (!Number.isSafeInteger(debitCents) || debitEuros < MIN_WITHDRAWAL)
    throw new Error(`Le minimum de retrait est de ${MIN_WITHDRAWAL} €.`);
  if (!Number.isFinite(Number(balance)) || debitCents > Math.round(Number(balance) * 100))
    throw new Error('Le montant dépasse votre solde disponible.');
  const stripeFee = Math.max(0.50, Math.round(debitEuros * STRIPE_INSTANT_RATE * 100) / 100);
  const fee = calculateWithdrawalFee(debitEuros);
  const feeCents = Math.round(fee * 100);
  if (debitCents <= feeCents) throw new Error('Le montant demandé doit être supérieur aux frais de retrait.');
  return { debit: debitEuros, fee, amount: (debitCents - feeCents) / 100, stripeFee, margin: STRASDRIVE_MARGIN };
}
