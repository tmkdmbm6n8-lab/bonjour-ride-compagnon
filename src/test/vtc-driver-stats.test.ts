import { describe, expect, it } from 'vitest';
import { driverWeekSummary } from '@/lib/vtc-driver-stats';
import { mondayOf, parisDay, parisInstant, validDay } from '@/lib/vtc-dates';
const ride = (overrides = {}) => ({ status: 'completed', is_test: false, accepted_at: '2026-11-15T09:00:00Z', completed_at: '2026-11-15T10:00:00Z', fare: { driverEarnings: 20, total: 25, activitySeconds: 3600 }, ...overrides });
describe('revenus chauffeur par jour parisien', () => {
  it('compte uniquement la semaine sélectionnée, les courses terminées et les vrais revenus', () => {
    const summary = driverWeekSummary([ride(), ride({ is_test: true }), ride({ status: 'cancelled' }), ride({ completed_at: '2026-11-08T10:00:00Z' })], '2026-11-15');
    expect(summary.start).toBe('2026-11-09'); expect(summary.end).toBe('2026-11-16');
    expect(summary.total).toBe(20); expect(summary.trips).toBe(1); expect(summary.activitySeconds).toBe(3600);
  });
  it('répartit le temps sur les deux jours sans déplacer le revenu de la fin de course', () => {
    const summary = driverWeekSummary([ride({ accepted_at: '2026-11-10T22:30:00Z', completed_at: '2026-11-10T23:30:00Z' })], '2026-11-15');
    expect(summary.byDay.find((d) => d._id === '2026-11-10')?.activitySeconds).toBe(1800);
    expect(summary.byDay.find((d) => d._id === '2026-11-11')?.activitySeconds).toBe(1800);
    expect(summary.byDay.find((d) => d._id === '2026-11-11')?.earnings).toBe(20);
  });
  it('conserve le travail du dimanche pour une course achevée le lundi suivant', () => {
    const summary = driverWeekSummary([ride({ accepted_at: '2026-11-15T22:30:00Z', completed_at: '2026-11-15T23:30:00Z' })], '2026-11-15');
    expect(summary.activitySeconds).toBe(1800); expect(summary.total).toBe(0); expect(summary.trips).toBe(0);
  });
  it('utilise les horodatages réels pour une ancienne course sans activitySeconds', () => {
    const summary = driverWeekSummary([ride({ fare: { driverEarnings: 20 } })], '2026-11-15');
    expect(summary.activitySeconds).toBe(3600);
  });
  it('ne fabrique pas de temps de travail depuis un devis', () => {
    const summary = driverWeekSummary([ride({ accepted_at: null, fare: { driverEarnings: 20 }, route: { durationSeconds: 900 } })], '2026-11-15');
    expect(summary.activitySeconds).toBe(0);
  });
  it('gère les minuits parisiens et le passage heure été/hiver', () => {
    expect(parisDay(new Date('2026-11-15T23:30:00Z'))).toBe('2026-11-16');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
    expect(parisInstant('2026-07-01')).toBe('2026-06-30T22:00:00.000Z');
    expect(parisInstant('2026-11-15')).toBe('2026-11-14T23:00:00.000Z');
    const hours = (Date.parse(parisInstant('2026-10-26')!) - Date.parse(parisInstant('2026-10-25')!)) / 3600000;
    expect(hours).toBe(25);
    expect(validDay('2026-02-30')).toBe(false);
  });
  it('ne modifie jamais les montants comptables', () => {
    const input = ride(); const before = JSON.stringify(input);
    driverWeekSummary([input], '2026-11-15'); expect(JSON.stringify(input)).toBe(before);
  });
});