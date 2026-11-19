// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import { handleAdminReportAction } from '@/lib/ride-chat.server';

describe('envoi des avertissements', () => {
  it('utilise le chauffeur de la course et crée un message de l’administration', async () => {
    const insert = vi.fn(async () => ({ data: null, error: null }));
    const lookup = vi.fn(async () => ({ data: { user: { email: 'driver@example.fr' } }, error: null }));
    const admin = { auth: { admin: { getUserById: lookup } }, from: (table: string) => {
      if (table === 'contact_messages') return { insert };
      const data = table === 'rides' ? { driver_id: 'driver-1', rider_id: 'rider-1' } : { name: 'Chauffeur' };
      const query = { select: () => query, eq: () => query, single: async () => ({ data, error: null }) };
      return query;
    } };
    await handleAdminReportAction(admin, { action: 'send_warning', rideId: 'ride-1', driverId: 'other', warningTarget: 'driver', warningText: 'Merci de respecter les règles.', email: 'wrong@example.fr' });
    expect(lookup).toHaveBeenCalledWith('driver-1');
    const row = insert.mock.calls[0][0];
    expect(row.email).toBe('driver@example.fr');
    expect(JSON.parse(row.message)).toMatchObject({ userId: 'driver-1', subject: 'Avertissement', messages: [{ from: 'admin' }] });
  });
});
