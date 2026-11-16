import { assertRadarReportPermission } from './vtc-road-alerts';

/** Read the current admin-managed flag; never trust a flag sent by the browser. */
export async function requireRadarReporter(admin, uid, kind) {
  if (kind !== 'radar') return;
  const { data, error } = await admin.from('drivers').select('is_priority').eq('user_id', uid).maybeSingle();
  if (error) throw new Error(error.message);
  assertRadarReportPermission(kind, data?.is_priority);
}
