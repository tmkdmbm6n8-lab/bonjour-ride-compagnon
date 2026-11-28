import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { reportedRideCount, sendDriverReport } from '@/lib/driver-reports.server';
import { driverReportMessage } from '@/lib/driver-reports';
const key = 'test-key-no-real-secret';
beforeEach(() => vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', key));
afterEach(() => vi.unstubAllEnvs());
function stored(id: string) {
  const text = driverReportMessage({ id, rider_id: 'rider', driver_id: 'driver' }, 'rider', { reason: 'aggression' });
  return { message: `${text}\nAuthentification : ${createHmac('sha256', key).update('driver-report:v1:' + text).digest('hex')}` };
}
function db(rows: any[], previous: any[] = []) {
  const updates: any[] = [];
  const inserts: any[] = [];
  const admin = { from: vi.fn((table: string) => {
    const q: any = {
      select: () => q, eq: () => q, like: () => q,
      limit: async () => ({ data: previous, error: null }),
      single: async () => ({ data: { stats: {} }, error: null }),
      insert: async (row: any) => { inserts.push(row); rows.push(row); return { data: null, error: null }; },
      update: (patch: any) => { updates.push({ table, patch }); return q; },
      then: (resolve: any) => Promise.resolve({ data: table === 'contact_messages' ? rows : null, error: null }).then(resolve),
    };
    return q;
  }) };
  return { admin, updates, inserts };
}
const args = { ride: { id: 'third', rider_id: 'rider', driver_id: 'driver' }, uid: 'rider', email: 'rider@example.test', name: 'Client', body: { reason: 'aggression' } };
describe('suspension chauffeur après trois courses signalées', () => {
  it('enregistre le signalement sans suspension automatique, en attente de modération', async () => {
    const mock = db([stored('one'), stored('two')]);
    await sendDriverReport(mock.admin, args);
    expect(mock.inserts).toHaveLength(1);
    expect(mock.updates).toHaveLength(0);
    expect(mock.admin.from).not.toHaveBeenCalledWith('profiles');
  });
  it('ne crée pas de second signalement pour la même course', async () => {
    const previous = stored('third');
    const mock = db([previous], [previous]);
    await sendDriverReport(mock.admin, args);
    expect(mock.inserts).toHaveLength(0);
    expect(mock.updates).toHaveLength(0);
  });
  it('ne suspend pas avant trois courses différentes', async () => {
    const mock = db([stored('one')]);
    await sendDriverReport(mock.admin, args);
    expect(mock.updates).toHaveLength(0);
  });
  it('ignore une mention d’un autre chauffeur dans le commentaire', async () => {
    const mock = db([stored('one')]);
    expect(await reportedRideCount(mock.admin, 'other-driver')).toBe(0);
  });
  it('ne compte pas les doublons ni un faux signalement provenant du formulaire public', async () => {
    const forged = { message: driverReportMessage({ id: 'fake', rider_id: 'rider', driver_id: 'driver' }, 'rider', { reason: 'aggression' }) };
    const mock = db([stored('one'), stored('one'), forged]);
    expect(await reportedRideCount(mock.admin, 'driver')).toBe(1);
  });
});
