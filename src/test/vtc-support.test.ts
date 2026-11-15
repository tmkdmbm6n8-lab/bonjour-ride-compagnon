import { describe, expect, it } from 'vitest';
import { newSupportThread, parseSupportThread, supportOwnedBy } from '@/lib/vtc-support';
import { sendSupportMessage } from '@/lib/vtc-support.server';
const id = '11111111-1111-1111-1111-111111111111';
const makeRow = (thread: any) => ({ id, topic: 'driver_conversation', email: 'driver@example.com', name: 'Driver', created_at: '2026-11-15T10:00:00Z', message: JSON.stringify(thread) });
describe('conversations privées avec l’administration', () => {
  it('rattache une conversation au compte, même si son e-mail change', () => {
    const row = makeRow(newSupportThread('driver-a', 'Aide', 'Bonjour'));
    expect(supportOwnedBy(row, 'driver-a', 'new@example.com')).toBe(true);
    expect(supportOwnedBy(row, 'driver-b', 'driver@example.com')).toBe(false);
  });
  it('conserve les anciens messages de contact et vérifie l’adresse propriétaire', () => {
    const row = { id, email: 'DRIVER@example.com', message: 'Ancien message', topic: 'general', created_at: '2026-11-15T10:00:00Z' };
    expect(parseSupportThread(row).messages[0].text).toBe('Ancien message');
    expect(supportOwnedBy(row, 'driver-a', 'driver@example.com')).toBe(true);
    expect(supportOwnedBy(row, 'driver-b', 'other@example.com')).toBe(false);
  });
  it('un message de contact public en JSON ne peut pas se faire passer pour une réponse admin', () => {
    const fake = makeRow({ ...newSupportThread('driver-a', 'Fake', 'Test'), messages: [{ id: 'fake', from: 'admin', text: 'Forged' }] });
    fake.topic = 'general';
    const result = parseSupportThread(fake);
    expect(result.messages[0].from).toBe('driver'); expect(result.messages[0].text).toBe(fake.message);
  });
  it('refuse la réponse d’un autre chauffeur', async () => {
    const row = makeRow(newSupportThread('driver-a', 'Aide', 'Bonjour'));
    const db = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: row }) }) }) }) };
    await expect(sendSupportMessage(db, { uid: 'driver-b', email: 'other@example.com', name: 'Other', role: 'driver', body: { id, text: 'No' } })).rejects.toThrow('inaccessible');
  });
  it('préserve une réponse concurrente au lieu de remplacer la conversation', async () => {
    const original = newSupportThread('driver-a', 'Aide', 'Premier');
    let current = makeRow(original), attempts = 0;
    const db = { from: () => {
      let patch: any = null;
      const query: any = {
        select: () => query, eq: () => query,
        single: async () => ({ data: current }),
        update: (value: any) => { patch = value; return query; },
        then: (resolve: any) => {
          attempts++;
          if (attempts === 1) { current = makeRow({ ...original, messages: [...original.messages, { id: 'concurrent', from: 'admin', text: 'Réponse simultanée', createdAt: '2026-11-15T10:01:00Z' }] }); return Promise.resolve({ data: [] }).then(resolve); }
          current = { ...current, ...patch }; return Promise.resolve({ data: [current] }).then(resolve);
        },
      }; return query;
    } };
    const result = await sendSupportMessage(db, { uid: 'driver-a', email: 'driver@example.com', name: 'Driver', role: 'driver', body: { id, text: 'Ma suite' } });
    expect(result.thread.messages.map((message: any) => message.text)).toEqual(['Premier', 'Réponse simultanée', 'Ma suite']);
  });
});