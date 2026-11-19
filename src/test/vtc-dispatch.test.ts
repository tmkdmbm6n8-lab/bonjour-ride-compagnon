import { describe, expect, it } from 'vitest';
import { planDispatch, canSeeOffer, PRIORITY_WINDOW_SECONDS, NEAREST_WINDOW_SECONDS, TEST_OFFER_SECONDS } from '@/lib/vtc-dispatch';

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

  it('réserve une offre privée au chauffeur ciblé jusqu’à son expiration', () => {
    const r = ride({ dispatch_phase: 'private', offer_driver_id: far.user_id, offer_expires_at: new Date(NOW + 60000).toISOString() });
    expect(planDispatch(r, all, NOW)).toBeNull();
    expect(canSeeOffer(r, far, NOW, all)).toBe(true);
    expect(canSeeOffer(r, near, NOW, all)).toBe(false);
    const next = planDispatch(r, all, NOW + 60000);
    expect(next?.dispatch_phase).toBeNull();
    expect(planDispatch(apply(r, next), all, NOW + 60000)?.dispatch_phase).toBe('priority');
  });

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
  it('le compte à rebours de l’envoi à tous dure 4 secondes puis interdit l’acceptation', () => {
    const r = apply(ride({dispatch_phase:'nearest'}), planDispatch(ride({dispatch_phase:'nearest'}), all, NOW));
    expect(r.offer_expires_at).toBe(new Date(NOW + 4000).toISOString());
    expect(canSeeOffer(r, near, NOW + 3999)).toBe(true);
    expect(canSeeOffer(r, near, NOW + 4000)).toBe(false);
    expect(planDispatch(r, all, NOW + 4000)?.status).toBe('no_drivers');
  });
  it('les demandes test durent également 4 secondes', () => {
    expect(TEST_OFFER_SECONDS).toBe(4);
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

import { availableFor, isThrottled } from '@/lib/vtc-dispatch';
describe('fair share (+30 %)', () => {
  const ride = { status: 'searching', vehicle_type: 'economy', declined: [] } as any;
  const drv = (id: string, earned: number, prio = false) => ({ user_id: id, vehicle_class: 'economy', accepts_classes: [], is_priority: prio, earned_today: earned });
  it('throttles a driver earning more than 30 % above the others', () => {
    const pool = [drv('rich', 100), drv('a', 40), drv('b', 50)];
    expect(isThrottled(pool[0], pool)).toBe(true);
    expect(availableFor(ride, pool).map((d: any) => d.user_id)).toEqual(['a', 'b']);
  });
  it('does not throttle at exactly 30 % above', () => {
    const pool = [drv('x', 65), drv('a', 50)];
    expect(isThrottled(pool[0], pool)).toBe(false);
  });
  it('never throttles priority drivers', () => {
    const pool = [drv('p', 300, true), drv('a', 0)];
    expect(isThrottled(pool[0], pool)).toBe(false);
  });
  it('still offers the ride when the throttled driver is the only one', () => {
    const pool = [drv('rich', 100)];
    expect(availableFor(ride, pool).map((d: any) => d.user_id)).toEqual(['rich']);
  });
});

import { pickupZoneProblem, ARRIVAL_ZONE_METERS } from '@/lib/vtc-dispatch';
describe('pickup zone (150 m)', () => {
  const pickup = { lat: 48.5833, lng: 7.7458 };
  it('allows a driver about 100 m away', () => {
    expect(pickupZoneProblem({ lat: 48.5842, lng: 7.7458 }, pickup)).toBeNull();
  });
  it('blocks a driver about 300 m away', () => {
    expect(pickupZoneProblem({ lat: 48.5860, lng: 7.7458 }, pickup)).toMatch(/Rapprochez-vous/);
  });
  it('blocks when there is no GPS position', () => {
    expect(pickupZoneProblem(null, pickup)).toMatch(/GPS/);
  });
});

describe('déclaration d’arrivée à 20 mètres', () => {
  const pickup = { lat: 48.5833, lng: 7.7458 };
  const north = (meters: number) => ({ lat: pickup.lat + (meters / 6371000) * (180 / Math.PI), lng: pickup.lng });
  it('autorise 19,99 m et refuse 20,01 m sans arrondir la distance', () => {
    expect(pickupZoneProblem(north(19.99), pickup, ARRIVAL_ZONE_METERS)).toBeNull();
    expect(pickupZoneProblem(north(20.01), pickup, ARRIVAL_ZONE_METERS)).toMatch(/Rapprochez-vous/);
  });
  it('refuse une position GPS ou un point de prise en charge indisponible', () => {
    expect(pickupZoneProblem(null, pickup, ARRIVAL_ZONE_METERS)).toMatch(/GPS/);
    expect(pickupZoneProblem(north(0), null, ARRIVAL_ZONE_METERS)).toMatch(/indisponible/);
  });
});
