import { accountRatingSummary } from './account-ratings.js';
export async function accountRating(admin, uid, mode = 'rider') {
  const driver = mode === 'driver';
  const result = await admin.from('rides').select('rating')
    .eq(driver ? 'driver_id' : 'rider_id', uid).eq('status', 'completed').eq('is_test', false)
    .not(driver ? 'rating->byRider' : 'rating->byDriver', 'is', null)
    .order('completed_at', {ascending:false}).limit(500);
  if (result.error) throw new Error('Impossible de charger les notes');
  return accountRatingSummary(result.data || [], mode);
}
