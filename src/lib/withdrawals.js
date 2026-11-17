export const MIN_WITHDRAWAL = 10;
// The entered amount is the total debited only on approval; the existing fee is included.
export function withdrawalQuote(value, balance, fee) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Indiquez un montant avec deux décimales au maximum.');
  const debitCents = Math.round(Number(text) * 100);
  const feeCents = Math.round(Number(fee) * 100);
  if (!Number.isSafeInteger(debitCents) || debitCents < MIN_WITHDRAWAL * 100)
    throw new Error('Le minimum de retrait est de 10 €.');
  if (!Number.isFinite(Number(balance)) || debitCents > Math.round(Number(balance) * 100))
    throw new Error('Le montant dépasse votre solde disponible.');
  if (!Number.isSafeInteger(feeCents) || feeCents < 0 || debitCents <= feeCents)
    throw new Error('Frais de retrait invalides.');
  return { debit: debitCents / 100, amount: (debitCents - feeCents) / 100, fee: feeCents / 100 };
}
