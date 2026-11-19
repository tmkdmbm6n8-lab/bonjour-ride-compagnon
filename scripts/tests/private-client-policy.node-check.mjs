import { test } from 'node:test';
import assert from 'node:assert/strict';
import { favoriteCancellationIsFree, privateDriverWaitMinutes, privateOfferDecision } from '../../src/lib/private-client-policy.js';

const base = { favoriteId: 'driver', riderId: 'rider', driver: { user_id: 'driver', is_approved: true, is_online: true, eligible: true }, now: 1000 };

test('only the eligible favorite receives a private offer, regardless of distance', () => {
  assert.deepEqual(privateOfferDecision(base), { kind: 'priority', driverId: 'driver' });
  assert.deepEqual(privateOfferDecision({ ...base, driver: { ...base.driver, is_online: false } }), { kind: 'ordinary' });
  assert.deepEqual(privateOfferDecision({ ...base, riderId: 'driver' }), { kind: 'ordinary' });
});

test('a busy driver is queued only with the rider’s explicit choice', () => {
  const driver = { ...base.driver, busy: true };
  assert.equal(privateOfferDecision({ ...base, driver }).kind, 'ordinary');
  assert.equal(privateOfferDecision({ ...base, driver, choice: 'wait' }).kind, 'queue');
});

test('an expired private offer falls back and estimates require both legs', () => {
  assert.equal(privateOfferDecision({ ...base, existingPhase: 'private', deadline: 1000 }).kind, 'ordinary');
  assert.equal(privateDriverWaitMinutes(1200, 620), 31);
  assert.equal(privateDriverWaitMinutes(null, 620), null);
  assert.equal(privateDriverWaitMinutes(1200, -1), null);
});

test('favorite status does not override the standard cancellation rules', () => {
  const ride = { rider_id: 'rider', driver_id: 'favorite', favorite_driver_id: 'favorite', status: 'accepted' };
  assert.equal(favoriteCancellationIsFree(ride, 'rider'), false);
  assert.equal(favoriteCancellationIsFree({ ...ride, status: 'arrived' }, 'rider'), false);
  assert.equal(favoriteCancellationIsFree({ ...ride, status: 'in_progress' }, 'rider'), false);
  assert.equal(favoriteCancellationIsFree({ ...ride, driver_id: 'other' }, 'rider'), false);
  assert.equal(favoriteCancellationIsFree(ride, 'other'), false);
});
