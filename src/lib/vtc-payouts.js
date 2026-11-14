// Versements des chauffeurs : virement automatique chaque semaine, dans la nuit de dimanche à lundi
// à minuit (heure de Paris). Un retrait avant cette date coûte des frais fixes.
// Pur et testé : le serveur et la tâche planifiée s'appuient sur ces règles.

export const PAYOUT_TIMEZONE = 'Europe/Paris';
export const EARLY_PAYOUT_FEE = 0.5;     // € de frais pour un retrait anticipé
export const MIN_EARLY_PAYOUT = 5;       // € minimum versé lors d'un retrait anticipé (après frais)

const round2 = (n) => Math.round(n * 100) / 100;

/** Composants de date/heure à Paris pour un instant donné. */
function parisParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PAYOUT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { year: +get('year'), month: +get('month'), day: +get('day'), hour: +get('hour'), minute: +get('minute'), weekday: get('weekday') };
}

/** Instant UTC correspondant à minuit (00:00) à Paris pour une date civile parisienne. */
function parisMidnight(year, month, day) {
  // Paris est à UTC+1 ou UTC+2 : on essaie les deux et on garde celui qui tombe à 00:00 local.
  for (const offset of [1, 2]) {
    const d = new Date(Date.UTC(year, month - 1, day, -offset, 0, 0));
    const p = parisParts(d);
    if (p.hour === 0 && p.minute === 0 && p.day === day) return d;
  }
  return new Date(Date.UTC(year, month - 1, day, -1));
}

/** Le lundi (date parisienne AAAA-MM-JJ) dont le virement de minuit couvre l'instant donné. */
export function payoutWeekKey(date = new Date()) {
  const p = parisParts(date);
  const iso = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  return iso;
}

/** Vrai pendant la première heure du lundi à Paris : la tâche planifiée verse les soldes. */
export function isPayoutWindow(date = new Date()) {
  const p = parisParts(date);
  return p.weekday === 'Mon' && p.hour === 0;
}

/** Prochain virement automatique : le lundi suivant à 00:00, heure de Paris. */
export function nextPayoutAt(date = new Date()) {
  const p = parisParts(date);
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const daysAhead = 7 - order.indexOf(p.weekday); // lundi → 7 (le suivant), dimanche → 1
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day + daysAhead));
  return parisMidnight(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
}

/** Montant versé au virement automatique : tout le solde positif, sans frais. */
export function weeklyPayoutAmount(balance) {
  const b = round2(Number(balance) || 0);
  return b > 0 ? b : 0;
}

/** Retrait anticipé de tout le solde : le chauffeur reçoit le solde moins les frais. */
export function earlyPayoutQuote(balance) {
  const b = round2(Number(balance) || 0);
  const amount = round2(b - EARLY_PAYOUT_FEE);
  if (amount < MIN_EARLY_PAYOUT) {
    return { ok: false, amount: 0, fee: EARLY_PAYOUT_FEE, reason: `Un retrait anticipé demande au moins ${(MIN_EARLY_PAYOUT + EARLY_PAYOUT_FEE).toFixed(2).replace('.', ',')} € de solde` };
  }
  return { ok: true, amount, fee: EARLY_PAYOUT_FEE };
}
