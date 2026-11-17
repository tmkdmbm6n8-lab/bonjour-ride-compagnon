import { advanceOnlineTime } from './driver-online-time.js';

/** Compare-and-set protects concurrent GPS pings, status changes and settlement stats. */
export async function recordOnlineTime(db, uid, { online, patch = {} } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await db.from('drivers').select('stats,is_online').eq('user_id', uid).single();
    if (current.error) throw new Error('Impossible de lire le temps de connexion');
    const driver = current.data;
    const nextOnline = online ?? driver.is_online;
    const lastSeen = Date.parse(driver.stats?.onlineTime?.lastSeen || "");
    if (online === undefined && driver.is_online && Date.now() - lastSeen < 10000)
      return driver.stats.onlineTime;
    if (!driver.is_online && online === undefined && !driver.stats?.onlineTime?.lastSeen)
      return driver.stats?.onlineTime || { days: {} };
    const onlineTime = advanceOnlineTime(driver.stats?.onlineTime, driver.is_online, nextOnline);
    const result = await db.from('drivers')
      .update({ ...patch, stats: { ...driver.stats, onlineTime } })
      .eq('user_id', uid).eq('is_online', driver.is_online)
      .eq('stats', JSON.stringify(driver.stats)).select('user_id');
    if (result.error) throw new Error('Impossible d’enregistrer le temps de connexion');
    if (result.data?.length) return onlineTime;
  }
  throw new Error('Actualisation simultanée : réessayez');
}
