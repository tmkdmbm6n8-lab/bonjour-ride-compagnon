import { beforeEach, describe, expect, it } from 'vitest';
import { enqueue, flushQueue, isNetworkFailure, readQueue } from '@/lib/offline-queue';

describe('file hors connexion', () => {
  beforeEach(() => localStorage.clear());
  it('garde les actions dans l’ordre puis les efface après synchronisation', async () => {
    enqueue('r1', 'arrive', null, 1); enqueue('r1', 'complete', null, 2);
    const sent: string[] = [];
    await flushQueue(async (i: any) => { sent.push(i.action); return {}; });
    expect(sent).toEqual(['arrive', 'complete']);
    expect(readQueue()).toEqual([]);
  });
  it('conserve tout si le réseau manque encore', async () => {
    enqueue('r1', 'complete');
    await flushQueue(async () => { throw new TypeError('Failed to fetch'); });
    expect(readQueue()).toHaveLength(1);
  });
  it('ne met jamais en attente l’acceptation d’une course', () => {
    expect(enqueue('r1', 'accept')).toBe(false);
  });
  it('reconnaît une réponse « base de données injoignable » comme une absence de réseau', () => {
    expect(isNetworkFailure(Object.assign(new Error('x'), { code: 'OFFLINE' }))).toBe(true);
    expect(isNetworkFailure(new Error('Course déjà prise'))).toBe(navigator.onLine === false);
  });
});
