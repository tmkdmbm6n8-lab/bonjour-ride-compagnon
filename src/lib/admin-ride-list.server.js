import { adminRideDateRange, archiveListRow } from './admin-ride-record.js';
function checked(result) { if (result.error) throw new Error(result.error.message); return result.data; }
// Liste admin : courses actuelles et archives encore conservées (même sans course ni profil), dédupliquées en base.
export async function adminRideList(admin, actor, q, serializeRide) {
  const page = Math.max(1, Number(q.get('page')) || 1), limit = Math.min(100, Math.max(1, Number(q.get('limit')) || 15));
  const range = q.get('day') ? adminRideDateRange(q.get('day')) : { from: null, to: null };
  const index = checked(await admin.rpc('admin_ride_index', { _actor: actor, _from: range.from, _to: range.to, _status: q.get('status') || null, _limit: limit, _offset: (page - 1) * limit })) || { total: 0, rows: [] };
  const rows = index.rows || [];
  const rideIds = rows.filter((r) => r.source === 'ride').map((r) => r.id), archiveIds = rows.filter((r) => r.source === 'archive').map((r) => r.id);
  const [rides, archives] = await Promise.all([
    rideIds.length ? admin.from('rides').select('*').in('id', rideIds) : { data: [] },
    archiveIds.length ? admin.from('ride_archives').select('ride_id,ride_created_at,final_status,accounting,contacts,booking,personal_erased_at').in('ride_id', archiveIds) : { data: [] },
  ]);
  const byRide = new Map((checked(rides) || []).map((r) => [r.id, r])), byArchive = new Map((checked(archives) || []).map((a) => [a.ride_id, a]));
  const out = await Promise.all(rows.map(async (row) => {
    if (row.source === 'archive') return byArchive.has(row.id) ? archiveListRow(byArchive.get(row.id)) : null;
    const ride = byRide.get(row.id);
    if (!ride) return null;
    return { ...(await serializeRide(ride)), archived: Boolean(row.archived), source: 'ride' };
  }));
  const total = Number(index.total) || 0;
  return { rides: out.filter(Boolean), pagination: { page, pages: Math.ceil(total / limit), total } };
}
