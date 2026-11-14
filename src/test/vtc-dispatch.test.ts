import { describe, expect, it } from 'vitest';
import { planDispatch, canSeeOffer, PRIORITY_WINDOW_SECONDS, NEAREST_WINDOW_SECONDS } from '@/lib/vtc-dispatch';

const NOW = Date.parse('2026-11-14T10:00:00Z');
const pickup = { lat: 48.5839, lng: 7.7455 }; // Place Kléber
const at = (km: number) => ({ lat: pickup.lat + km / 111, lng: pickup.lng });
const driver = (id: string, km: number, isPriority = false) => ({ user_id: id, is_priority: isPriority, location: at(km), vehicle: { type: 'economy' } });
const ride = (extra: Record<string, unknown> = {}) => ({ id: 'r1', status: 'searching', vehicle_type: 'economy', pickup, declined: [] as string[], dispatch_phase: null, offer_driver_id: null, offer_expires_at: null, ...extra });
const apply = (r: any, patch: any) => ({ ...r, ...patch });

describe('attribution des courses', () => {
  const far = driver('prio-loin', 25, true);
  const prio2 = driver('prio-2', 3, true);
  const near = driver('proche', 0.5);
  const other = driver('autre', 4);
  const all = [far, prio2, near, other];

  it('tous les chauffeurs prioritaires reçoivent la course en même temps, même loin', () => {
    const r = apply(ride(), planDispatch(ride(), all, NOW));
    expect(r.dispatch_phase).toBe('priority');
    expect(canSeeOffer(r, far, NOW)).toBe(true);
    expect(canSeeOffer(r, prio2, NOW)).toBe(true);
    expect(canSeeOffer(r, near, NOW)).toBe(false);
    expect(canSeeOffer(r, other, NOW)).toBe(false);
  });

  it('si aucun prioritaire n’accepte, le chauffeur le plus proche la reçoit seul', () => {
    const r1 = apply(ride(), planDispatch(ride(), all, NOW));
    const later = NOW + PRIORITY_WINDOW_SECONDS * 1000;
    const r2 = apply(r1, planDispatch(r1, all, later));
    expect(r2.dispatch_phase).toBe('nearest');
    expect(r2.offer_driver_id).toBe('proche');
    expect(canSeeOffer(r2, other, later)).toBe(false);
    expect(canSeeOffer(r2, far, later)).toBe(false);
  });

  it('les prioritaires qui refusent tous passent la main sans attendre', () => {
    const r1 = apply(ride(), planDispatch(ride(), all, NOW));
    const r2 = { ...r1, declined: ['prio-loin', 'prio-2'] };
    expect(planDispatch(r2, all, NOW + 1000)?.offer_driver_id).toBe('proche');
  });

  it('ensuite tous les chauffeurs disponibles sont notifiés ensemble', () => {
    const r1 = { ...ride(), dispatch_phase: 'nearest', offer_driver_id: 'proche', offer_expires_at: new Date(NOW).toISOString() };
    const later = NOW + NEAREST_WINDOW_SECONDS * 1000;
    const r2 = apply(r1, planDispatch(r1, all, later));
    expect(r2.dispatch_phase).toBe('broadcast');
    for (const d of all) expect(canSeeOffer(r2, d, later)).toBe(true);
  });

  it('sans chauffeur prioritaire en ligne, le plus proche est servi en premier', () => {
    const r = planDispatch(ride(), [near, other], NOW);
    expect(r?.dispatch_phase).toBe('nearest');
    expect(r?.offer_driver_id).toBe('proche');
  });

  it('un chauffeur qui a refusé ne revoit pas la course', () => {
    const r = { ...ride(), dispatch_phase: 'broadcast', offer_expires_at: new Date(NOW + 30000).toISOString(), declined: ['autre'] };
    expect(canSeeOffer(r, other, NOW)).toBe(false);
    expect(canSeeOffer(r, near, NOW)).toBe(true);
  });

  it('personne n’accepte pendant l’envoi à tous : la course passe sans chauffeur', () => {
    const r = { ...ride(), dispatch_phase: 'broadcast', offer_expires_at: new Date(NOW).toISOString() };
    expect(planDispatch(r, all, NOW)?.status).toBe('no_drivers');
  });
});

import { profitability, approachSecondsFor } from '@/lib/vtc-dispatch';

describe('rentabilité affichée au chauffeur prioritaire (gain net par heure, approche comprise)', () => {
  it('très rentable dès 45 € de l’heure', () => {
    expect(profitability(15, 600, 600).level).toBe('very_profitable'); // 15 € en 20 min = 45 €/h
  });
  it('rentable de 30 € à moins de 45 € de l’heure', () => {
    expect(profitability(10, 600, 600).level).toBe('profitable'); // 30 €/h
    expect(profitability(14.9, 600, 600).level).toBe('profitable');
  });
  it('non rentable sous 30 € de l’heure', () => {
    expect(profitability(9.9, 600, 600).level).toBe('not_profitable');
  });
  it('le temps jusqu’au client compte : 5 km d’approche = 12 minutes', () => {
    expect(Math.round(approachSecondsFor(5000))).toBe(720);
  });
});
