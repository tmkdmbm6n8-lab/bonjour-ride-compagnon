import { describe, expect, it } from 'vitest';
import { servedClasses, canServe, sanitizeAcceptedClasses, availabilityByClass, isLowerClassRide } from '@/lib/vtc-classes';
import { planDispatch, canSeeOffer } from '@/lib/vtc-dispatch';

const pickup = { lat: 48.5839, lng: 7.7455 };
const d = (id: string, cls: string, accepts: string[] = [], km = 1) => ({ user_id: id, vehicle_class: cls, accepts_classes: accepts, is_priority: false, location: { lat: pickup.lat + km / 111, lng: pickup.lng } });

describe('gammes de véhicules', () => {
  it('un Go ne fait que des courses Go', () => {
    expect(servedClasses(d('a', 'economy', ['comfort', 'premium']))).toEqual(['economy']);
  });
  it('un Comfort peut accepter le Go, jamais le Lux ni le XL', () => {
    expect(sanitizeAcceptedClasses('comfort', ['economy', 'premium', 'xl'])).toEqual(['economy']);
    expect(canServe(d('a', 'comfort', ['economy']), 'economy')).toBe(true);
    expect(canServe(d('a', 'comfort'), 'economy')).toBe(false);
  });
  it('un Lux peut cocher Comfort et/ou Go, mais pas le XL', () => {
    expect(servedClasses(d('a', 'premium', ['economy']))).toEqual(['premium', 'economy']);
    expect(servedClasses(d('a', 'premium', ['comfort', 'economy', 'xl']))).toEqual(['premium', 'comfort', 'economy']);
  });
  it('un XL peut accepter uniquement Go et Comfort, pas le Lux', () => {
    expect(sanitizeAcceptedClasses('xl', ['economy', 'comfort', 'premium'])).toEqual(['economy', 'comfort']);
    expect(canServe(d('a', 'xl', ['premium']), 'premium')).toBe(false);
  });
  it('un Lux ne reçoit pas de course XL', () => {
    expect(canServe(d('a', 'premium', ['comfort', 'economy']), 'xl')).toBe(false);
  });
  it('côté client : un Go + un Comfort qui accepte le Go = 2 chauffeurs disponibles en Go', () => {
    const a: any = availabilityByClass([d('go', 'economy', [], 2), d('cf', 'comfort', ['economy'], 1)], pickup);
    expect(a.economy.count).toBe(2);
    expect(a.comfort.count).toBe(1);
    expect(a.premium.count).toBe(0);
  });
  it('un Comfort qui accepte le Go reçoit la course Go (au tarif Go, celui de la course)', () => {
    const cf = d('cf', 'comfort', ['economy']);
    const ride: any = { id: 'r', status: 'searching', vehicle_type: 'economy', pickup, declined: [], dispatch_phase: null, offer_driver_id: null, offer_expires_at: null };
    const now = Date.now();
    const r = { ...ride, ...planDispatch(ride, [cf], now) };
    expect(canSeeOffer(r, cf, now)).toBe(true);
    expect(isLowerClassRide(cf, 'economy')).toBe(true);
    expect(canSeeOffer(r, d('cf2', 'comfort'), now)).toBe(false);
  });
});
