import { describe, it, expect } from 'vitest';
import { bookingPaymentProblem, paymentMethodOf } from '@/lib/vtc-pricing';
import { topupAmountProblem, toCents, cardBookingExpired, safeOrigin } from '@/lib/vtc-checkout';

describe('Recharge du portefeuille (montant libre)', () => {
  it('accepts 5 €', () => expect(topupAmountProblem(5)).toBeNull());
  it('accepts 1 000 €', () => expect(topupAmountProblem(1000)).toBeNull());
  it('accepts any amount in cents such as 12,50 €', () => expect(topupAmountProblem('12.50')).toBeNull());
  it('refuses less than 5 €', () => expect(topupAmountProblem(4.99)).toMatch(/entre 5/));
  it('refuses more than 1 000 €', () => expect(topupAmountProblem(1000.01)).toMatch(/entre 5/));
  it('refuses fractions of a cent', () => expect(topupAmountProblem(10.005)).toMatch(/deux décimales/));
  it('charges the exact amount in cents', () => expect(toCents(12.5)).toBe(1250));
});

describe('Course payée par carte', () => {
  it('is its own payment method', () => expect(paymentMethodOf('card')).toBe('card'));
  it('does not need wallet balance', () => expect(bookingPaymentProblem('card', 0, 27)).toBeNull());
  it('is refused while the wallet is in debt', () => expect(bookingPaymentProblem('card', -3, 27)).toMatch(/débiteur/));
  it('must be confirmed within 30 minutes', () => {
    const now = Date.parse('2026-11-15T12:00:00Z');
    expect(cardBookingExpired('2026-11-15T11:31:00Z', now)).toBe(false);
    expect(cardBookingExpired('2026-11-15T11:29:00Z', now)).toBe(true);
  });
  it('expires malformed or future-dated bookings instead of keeping them pending forever', () => {
    const now = Date.parse('2026-11-21T12:00:00Z');
    expect(cardBookingExpired('not-a-date', now)).toBe(true);
    expect(cardBookingExpired('', now)).toBe(true);
    expect(cardBookingExpired(null, now)).toBe(true);
    expect(cardBookingExpired('2026-11-21T12:01:00Z', now)).toBe(true);
  });
  it('only returns to a plain site address', () => {
    expect(safeOrigin('https://bonjour-ride-compagnon.lovable.app')).toBe('https://bonjour-ride-compagnon.lovable.app');
    expect(safeOrigin('https://evil.example/path')).toBeNull();
    expect(safeOrigin('https://evil.example', 'https://strasdrive.fr')).toBeNull();
    expect(safeOrigin('https://strasdrive.fr', 'https://strasdrive.fr')).toBe('https://strasdrive.fr');
    expect(safeOrigin('http://strasdrive.fr', 'http://strasdrive.fr')).toBeNull();
    expect(safeOrigin('http://localhost:3000', 'http://localhost:3000')).toBe('http://localhost:3000');
    expect(safeOrigin('https://strasdrive.fr', undefined)).toBe('https://strasdrive.fr');
  });
});
