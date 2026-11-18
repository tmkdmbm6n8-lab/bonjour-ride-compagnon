import { describe, expect, it } from 'vitest';
import { validProfileAvatar } from '@/lib/profile-avatar';

describe('validation de la photo de profil', () => {
  it('accepte une image JPEG encodée', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]).toString('base64');
    expect(validProfileAvatar(`data:image/jpeg;base64,${jpeg}`)).toBe(true);
  });
  it('refuse une image trop grande, un autre type ou des octets non JPEG', () => {
    expect(validProfileAvatar(`data:image/jpeg;base64,${'A'.repeat(180_004)}`)).toBe(false);
    expect(validProfileAvatar('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(validProfileAvatar('data:image/jpeg;base64,SGVsbG8=')).toBe(false);
    expect(validProfileAvatar(null)).toBe(false);
  });
});
