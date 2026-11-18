import { describe, expect, it } from 'vitest';
import {
  calculateWarningExpiry,
  countActiveWarnings,
  isWarningActive,
  shouldSuspendDriver,
} from '@/lib/driver-warnings';

describe('Système d avertissements chauffeur', () => {
  const now = new Date('2026-11-18T12:00:00Z').getTime();

  it('ne compte pas un signalement très léger', () => {
    const decision = { degree: 'very_mild', expiresAt: null, isDismissed: false };
    expect(isWarningActive(decision, now)).toBe(false);
    expect(countActiveWarnings([decision], now)).toBe(0);
  });

  it('compte un avertissement léger pendant 14 jours puis expire', () => {
    const expiresAt = calculateWarningExpiry('mild', new Date(now));
    const decision = { degree: 'mild', expiresAt, isDismissed: false };

    // Actif à J+13
    const day13 = now + 13 * 24 * 3600 * 1000;
    expect(isWarningActive(decision, day13)).toBe(true);

    // Inactif à J+15
    const day15 = now + 15 * 24 * 3600 * 1000;
    expect(isWarningActive(decision, day15)).toBe(false);
  });

  it('compte un avertissement moyen pendant 30 jours puis expire', () => {
    const expiresAt = calculateWarningExpiry('medium', new Date(now));
    const decision = { degree: 'medium', expiresAt, isDismissed: false };

    // Actif à J+29
    const day29 = now + 29 * 24 * 3600 * 1000;
    expect(isWarningActive(decision, day29)).toBe(true);

    // Inactif à J+31
    const day31 = now + 31 * 24 * 3600 * 1000;
    expect(isWarningActive(decision, day31)).toBe(false);
  });

  it('maintient un avertissement grave sans expiration', () => {
    const decision = { degree: 'severe', expiresAt: null, isDismissed: false };
    const twoYearsLater = now + 730 * 24 * 3600 * 1000;
    expect(isWarningActive(decision, twoYearsLater)).toBe(true);
  });

  it('suspend au troisième avertissement actif', () => {
    const d1 = { degree: 'severe', expiresAt: null, isDismissed: false };
    const d2 = { degree: 'severe', expiresAt: null, isDismissed: false };
    expect(shouldSuspendDriver([d1, d2], now)).toBe(false);

    const d3 = { degree: 'severe', expiresAt: null, isDismissed: false };
    expect(shouldSuspendDriver([d1, d2, d3], now)).toBe(true);
  });

  it('suspend immédiatement sur décision extrêmement grave', () => {
    const critical = { degree: 'critical', expiresAt: null, isDismissed: false };
    expect(shouldSuspendDriver([critical], now)).toBe(true);
  });

  it('ne suspend pas si un avertissement a expiré et laisse le total sous 3', () => {
    const expired = {
      degree: 'mild',
      expiresAt: new Date(now - 1000).toISOString(),
      isDismissed: false,
    };
    const active1 = { degree: 'severe', expiresAt: null, isDismissed: false };
    const active2 = { degree: 'severe', expiresAt: null, isDismissed: false };

    expect(countActiveWarnings([expired, active1, active2], now)).toBe(2);
    expect(shouldSuspendDriver([expired, active1, active2], now)).toBe(false);
  });
});

