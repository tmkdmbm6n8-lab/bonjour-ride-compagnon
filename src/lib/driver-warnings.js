export const WARNING_DEGREES = {
  very_mild: {
    id: 'very_mild',
    label: 'Très léger',
    countsAsWarning: false,
    durationDays: null,
    color: null,
    badgeClass: 'badge-neutral',
    description: 'Ne compte pas dans les avertissements.',
  },
  mild: {
    id: 'mild',
    label: 'Léger',
    countsAsWarning: true,
    durationDays: 14,
    color: '#eab308',
    badgeClass: 'badge-warning',
    description: 'Compte pendant 14 jours puis expire automatiquement.',
  },
  medium: {
    id: 'medium',
    label: 'Moyen',
    countsAsWarning: true,
    durationDays: 30,
    color: '#f97316',
    badgeClass: 'badge-orange',
    description: 'Compte pendant 1 mois puis expire automatiquement.',
  },
  severe: {
    id: 'severe',
    label: 'Grave',
    countsAsWarning: true,
    durationDays: null,
    color: '#ef4444',
    badgeClass: 'badge-danger',
    description: 'Reste au compteur sans expiration automatique.',
  },
  critical: {
    id: 'critical',
    label: 'Extrêmement grave',
    countsAsWarning: true,
    durationDays: null,
    color: '#b91c1c',
    badgeClass: 'badge-critical',
    immediateSuspension: true,
    description: 'Entraîne une suspension définitive immédiate du compte chauffeur.',
  },
};

export function calculateWarningExpiry(degreeId, decidedAt = new Date()) {
  const degree = WARNING_DEGREES[degreeId];
  if (!degree || !degree.durationDays) return null;
  const start = typeof decidedAt === 'string' ? Date.parse(decidedAt) : decidedAt.getTime();
  return new Date(start + degree.durationDays * 24 * 3600 * 1000).toISOString();
}

export function isWarningActive(decision, now = Date.now()) {
  if (!decision || decision.isDismissed) return false;
  const degree = WARNING_DEGREES[decision.degree];
  if (!degree || !degree.countsAsWarning) return false;
  if (degree.immediateSuspension || degree.durationDays === null) return true;
  if (!decision.expiresAt) return false;
  return Date.parse(decision.expiresAt) > now;
}

export function countActiveWarnings(decisions, now = Date.now()) {
  if (!Array.isArray(decisions)) return 0;
  return decisions.filter((d) => isWarningActive(d, now)).length;
}

export function shouldSuspendDriver(decisions, now = Date.now()) {
  if (!Array.isArray(decisions)) return false;
  const hasCritical = decisions.some(
    (d) => !d.isDismissed && d.degree === 'critical'
  );
  if (hasCritical) return true;
  return countActiveWarnings(decisions, now) >= 3;
}

