import { describe, it, expect, beforeEach } from 'vitest';
import { storedSessionUser } from '@/lib/offline-session';

describe('saved session on the phone', () => {
  beforeEach(() => localStorage.clear());
  it('finds the signed-in user without network', () => {
    localStorage.setItem('sb-abc-auth-token', JSON.stringify({ refresh_token: 'r', user: { id: 'u1' } }));
    expect(storedSessionUser()?.id).toBe('u1');
  });
  it('reports signed out when nothing is saved', () => {
    expect(storedSessionUser()).toBeNull();
  });
});
