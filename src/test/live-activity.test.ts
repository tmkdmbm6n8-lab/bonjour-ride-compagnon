import { describe, expect, it } from 'vitest';
import { driverOfferActivity, riderTripActivity } from '@/lib/live-activity';

describe('données des futures activités en direct iOS', () => {
  it('prépare les durées, le gain et la limite de validité d’une offre sans les données personnelles', () => {
    const result = driverOfferActivity({ rideId: 'ride-1', etaMinutes: 4, durationSeconds: 740, earnings: 10.63, receivedAt: 100000, expiresInSeconds: 15, rider: { name: 'Secret' }, pickup: { address: 'Adresse privée' }, pin: '1234' });
    expect(result).toEqual({ kind: 'driver_offer', reference: 'ride-1', pickupMinutes: 4, tripMinutes: 13, amountCents: 1063, expiresAt: 115000 });
    expect(JSON.stringify(result)).not.toMatch(/Secret|Adresse|1234/);
  });
  it('ne fabrique pas de montants ni d’horaires manquants', () => {
    expect(driverOfferActivity({ rideId: 'r', receivedAt: 100, expiresInSeconds: 5 })).toMatchObject({ pickupMinutes: null, tripMinutes: null, amountCents: null });
    expect(driverOfferActivity({ rideId: 'r' })).toBeNull();
  });
  it('ne conserve pas une estimation d’une étape précédente et termine les courses closes', () => {
    const ride = { id: 'r', status: 'in_progress' };
    expect(riderTripActivity(ride, { status: 'accepted', durationSeconds: 60 })?.remainingMinutes).toBeNull();
    expect(riderTripActivity(ride, { status: 'in_progress', durationSeconds: 121 })?.remainingMinutes).toBe(3);
    expect(riderTripActivity({ id: 'r', status: 'completed' }, null)).toBeNull();
  });
});
