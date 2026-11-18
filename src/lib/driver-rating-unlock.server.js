import { DRIVER_RATING_UNLOCK_COUNT } from './driver-rating-summary.js';

// Claim the one-time celebration on the account, not on the device. Demo mode never calls this.
export async function claimRatingCelebration(admin, uid) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await admin.from('drivers').select('stats,is_priority').eq('user_id', uid).single();
    if (current.error || !current.data) throw new Error('Impossible de vérifier le déblocage');
    const driver = current.data;
    if (driver.is_priority || driver.stats?.ratingUnlockSeenAt) return { celebrate: false };
    const ratings = await admin.from('rides').select('rating')
      .eq('driver_id', uid).eq('status', 'completed').eq('is_test', false)
      .not('rating->byRider', 'is', null)
      .lte('completed_at', new Date(Date.now() - 12 * 3600000).toISOString())
      .order('completed_at', { ascending: false }).limit(500);
    if (ratings.error) throw new Error('Impossible de vérifier les notes');
    const count = (ratings.data || []).filter((row) => Number.isInteger(row.rating?.byRider) && row.rating.byRider >= 1 && row.rating.byRider <= 5).length;
    if (count < DRIVER_RATING_UNLOCK_COUNT) return { celebrate: false };
    const result = await admin.from('drivers').update({ stats: { ...driver.stats, ratingUnlockSeenAt: new Date().toISOString() } })
      .eq('user_id', uid).eq('is_priority', false).eq('stats', JSON.stringify(driver.stats)).select('user_id');
    if (result.error) throw new Error('Impossible de mémoriser le déblocage');
    if (result.data?.length) return { celebrate: true };
  }
  throw new Error('Actualisation simultanée, réessayez');
}
