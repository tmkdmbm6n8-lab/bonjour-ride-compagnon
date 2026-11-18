import { describe, expect, it, vi } from 'vitest';
import { handleAdminReportAction } from '@/lib/ride-chat.server';

vi.mock('@/lib/driver-warnings.server', () => ({
  getRideDecision: vi.fn(), getDriverDecisions: vi.fn(),
  recordAdminDecision: vi.fn(async () => ({ decision: {}, activeWarningsCount: 1, driverSuspended: false })),
}));

describe('notification d’avertissement', () => {
  it('envoie un message même sans texte personnalisé', async () => {
    const insert = vi.fn(async () => ({ data: null, error: null }));
    const admin = { auth: { admin: { getUserById: async () => ({ data: { user: { email: 'driver@example.fr' } }, error: null }) } }, from: (table: string) => {
      if (table === 'contact_messages') return { insert };
      const data = table === 'rides' ? { driver_id: 'driver-1' } : { name: 'Chauffeur' };
      const query = { select: () => query, eq: () => query, single: async () => ({ data, error: null }) };
      return query;
    } };
    await handleAdminReportAction(admin, { action: 'classify_report', rideId: 'ride-1', degree: 'mild', warningText: '' });
    const thread = JSON.parse(insert.mock.calls[0][0].message);
    expect(thread.userId).toBe('driver-1');
    expect(thread.subject).toBe('Avertissement officiel');
    expect(thread.messages[0].from).toBe('admin');
    expect(thread.messages[0].text).toContain('avertissement');
    expect(thread.messages[0].text).not.toContain('Léger');
  });
});
