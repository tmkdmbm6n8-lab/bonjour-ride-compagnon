import { describe, expect, it } from 'vitest';
import { planDispatch } from '@/lib/vtc-dispatch';
import { newlyOfferedDriverIds, buildOfferMessage, isStaleTokenError, validPushToken, OFFER_CHANNEL_ID } from '@/lib/vtc-push';

const NOW = Date.parse('2026-11-16T10:00:00Z');
const pickup = { lat: 48.5839, lng: 7.7455, address: 'Place Kléber, 67000 Strasbourg' };
const at = (km: number) => ({ lat: pickup.lat + km / 111, lng: pickup.lng });
const driver = (id: string, km: number, isPriority = false) => ({ user_id: id, is_priority: isPriority, location: at(km), vehicle: { type: 'economy' } });
const ride = (extra: Record<string, unknown> = {}) => ({ id: 'r1', status: 'searching', vehicle_type: 'economy', pickup, fare: { driverEarnings: 12.4 }, declined: [] as string[], dispatch_phase: null, offer_driver_id: null, offer_expires_at: null, ...extra });

describe('notifications de course sur le téléphone', () => {
  const prio = driver('prio', 10, true);
  const near = driver('proche', 0.5);
  const far = driver('loin', 20);
  const pool = [prio, near, far];

  it('une nouvelle course notifie seulement les chauffeurs qui peuvent la voir à cette étape', () => {
    const before = ride();
    const after = { ...before, ...planDispatch(before, pool, NOW) };
    expect(newlyOfferedDriverIds(before, after, pool, NOW)).toEqual(['prio']);
  });

  it('à l’étape suivante, ceux déjà notifiés ne reçoivent pas une deuxième notification', () => {
    const r1 = { ...ride(), dispatch_phase: 'nearest', offer_driver_id: 'proche', offer_expires_at: new Date(NOW + 5000).toISOString() };
    const r2 = { ...r1, dispatch_phase: 'broadcast', offer_driver_id: null, offer_expires_at: new Date(NOW + 4000).toISOString() };
    const ids = newlyOfferedDriverIds(r1, r2, [near, far], NOW);
    expect(ids).toContain('loin');
    expect(ids).not.toContain('proche');
  });

  it('la notification affiche le gain et l’adresse, sans parler de l’ordre d’envoi', () => {
    const r = ride({ dispatch_phase: 'nearest', offer_expires_at: new Date(NOW + 10_000).toISOString() });
    const m = buildOfferMessage(r, NOW);
    expect(m.notification.title).toMatch(/12,40/);
    expect(m.notification.body).toBe('Prise en charge : Place Kléber');
    expect(JSON.stringify([m.notification, m.data])).not.toMatch(/nearest|priorit|proche/i);
  });

  it('la notification s’affiche en bannière avec son et disparaît si la course a expiré', () => {
    const m = buildOfferMessage(ride({ offer_expires_at: new Date(NOW + 10_000).toISOString() }), NOW);
    expect(m.android.priority).toBe('high');
    expect(m.android.notification.channel_id).toBe(OFFER_CHANNEL_ID);
    expect(m.android.ttl).toBe('10s');
  });

  it('un téléphone désinstallé est retiré de la liste', () => {
    expect(isStaleTokenError(404, '{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}')).toBe(true);
    expect(isStaleTokenError(500, 'internal')).toBe(false);
    expect(validPushToken('court')).toBeNull();
  });
});
