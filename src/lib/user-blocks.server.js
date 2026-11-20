/** User blocks are enforced server-side. Never prevent emergency support or
 * communications needed for a ride already accepted/in progress. */
const required = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
export async function listUserBlocks(admin, uid) {
  return required(await admin.from('user_blocks').select('blocked_id,created_at').eq('blocker_id', uid).order('created_at', { ascending: false }));
}
export async function setUserBlock(admin, uid, blockedId, blocked) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(blockedId)) || uid === blockedId)
    throw new Error('Utilisateur invalide');
  const active = required(await admin.from('rides').select('id').or(`and(rider_id.eq.${uid},driver_id.eq.${blockedId}),and(rider_id.eq.${blockedId},driver_id.eq.${uid})`).in('status', ['accepted', 'arrived', 'in_progress']).limit(1));
  if (blocked && active.length) throw new Error('Terminez la course en cours avant de bloquer cet utilisateur. Vous pouvez signaler un danger immédiatement.');
  if (blocked) required(await admin.from('user_blocks').upsert({ blocker_id: uid, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }));
  else required(await admin.from('user_blocks').delete().eq('blocker_id', uid).eq('blocked_id', blockedId));
  return { ok: true };
}
export async function isPairBlocked(admin, riderId, driverId) {
  if (!riderId || !driverId) return false;
  const rows = required(await admin.from('user_blocks').select('blocker_id').or(`and(blocker_id.eq.${riderId},blocked_id.eq.${driverId}),and(blocker_id.eq.${driverId},blocked_id.eq.${riderId})`).limit(1));
  return rows.length > 0;
}
