// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { favoriteStatus, favoriteEtaMinutes, pendingClaimUsable, PRIVATE_INVITATION_SECONDS, PRIVATE_CLAIM_HOURS } from '@/lib/private-client-policy';

describe('chauffeur favori', () => {
  it('le QR code vaut 5 minutes et l’invitation scannée 24 heures', () => {
    expect(PRIVATE_INVITATION_SECONDS).toBe(300);
    expect(PRIVATE_CLAIM_HOURS).toBe(24);
  });

  it('le favori est sélectionnable seulement s’il est libre et en ligne', () => {
    const d = { is_online: true, is_approved: true };
    expect(favoriteStatus({ driver: d, inPool: true, busy: false })).toBe('available');
    expect(favoriteStatus({ driver: d, inPool: false, busy: true })).toBe('busy');
    expect(favoriteStatus({ driver: { ...d, is_online: false }, inPool: false, busy: false })).toBe('offline');
    expect(favoriteStatus({ driver: null })).toBeNull();
  });

  it('n’invente jamais de délai d’arrivée', () => {
    expect(favoriteEtaMinutes(420)).toBe(7);
    expect(favoriteEtaMinutes(10)).toBe(1);
    expect(favoriteEtaMinutes(undefined)).toBeNull();
    expect(favoriteEtaMinutes(-5)).toBeNull();
  });

  it('une invitation expirée ou mal formée n’est pas réutilisée', () => {
    const token = 'a'.repeat(43);
    expect(pendingClaimUsable({ claimToken: token, expiresAt: 2000 }, 1000)).toBe(true);
    expect(pendingClaimUsable({ claimToken: token, expiresAt: 1000 }, 1000)).toBe(false);
    expect(pendingClaimUsable({ claimToken: 'court', expiresAt: 2000 }, 1000)).toBe(false);
  });
});
