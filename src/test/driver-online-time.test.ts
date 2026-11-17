import { describe, expect, it } from 'vitest';
import { advanceOnlineTime } from '../lib/driver-online-time';

describe('temps de connexion chauffeur', () => {
  const start = Date.parse('2026-11-17T22:59:30Z');
  it('compte l’attente en ligne et répartit le passage de minuit à Paris', () => {
    const connected = advanceOnlineTime({}, false, true, start);
    const next = advanceOnlineTime(connected, true, true, start + 60000);
    expect(next.days).toEqual({ '2026-11-17': 30, '2026-11-18': 30 });
    expect(advanceOnlineTime(next, true, true, start + 60000).days).toEqual(next.days);
  });
  it('ne compte pas un trou réseau ni une période hors ligne', () => {
    const connected = advanceOnlineTime({}, false, true, start);
    expect(advanceOnlineTime(connected, true, true, start + 600000).days).toEqual({});
    expect(advanceOnlineTime({}, false, false, start).days).toEqual({});
    expect(advanceOnlineTime(connected, true, false, start + 30000).lastSeen).toBeNull();
  });
  it('utilise les secondes réelles pendant le changement d’heure', () => {
    const next = advanceOnlineTime({ lastSeen: '2026-10-25T00:59:30Z', days: {} }, true, true, Date.parse('2026-10-25T01:00:30Z'));
    expect(next.days).toEqual({ '2026-10-25': 60 });
  });
  it('retire les anciens totaux du suivi', () => {
    expect(advanceOnlineTime({ days: { '2024-01-01': 99 } }, false, false, start).days).toEqual({});
  });
});
