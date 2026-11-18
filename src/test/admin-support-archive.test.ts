import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { archivedIds } from '@/lib/admin-support-archive.server';

describe('archivage des conversations administrateur', () => {
  const id = '287e439a-ab67-4df7-93c5-67eac0777c24';
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  it('archive une conversation sans modifier son contenu', () => {
    const rows = [{ id, message: 'Bonjour' }];
    const markers = [{ message: JSON.stringify({ id, fingerprint: hash('Bonjour') }) }];
    expect(archivedIds(rows, markers).has(id)).toBe(true);
    expect(rows[0].message).toBe('Bonjour');
  });
  it('réaffiche une conversation si un nouveau message arrive', () => {
    const rows = [{ id, message: 'Bonjour et nouveau message' }];
    const markers = [{ message: JSON.stringify({ id, fingerprint: hash('Bonjour') }) }, { message: 'invalide' }];
    expect(archivedIds(rows, markers).has(id)).toBe(false);
  });
});
