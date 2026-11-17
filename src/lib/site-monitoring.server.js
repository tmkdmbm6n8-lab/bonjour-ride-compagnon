const CACHE_MS = 10000;
// Aggregate activity only: these counts do not measure CPU, RAM or proven server capacity.
export function createActivityReader({ now = () => Date.now(), timer = () => performance.now() } = {}) {
  let snapshot = null, sampledAt = 0, pending = null;
  return async function read(admin) {
    if (snapshot && now() - sampledAt < CACHE_MS) return snapshot;
    if (pending) return pending;
    pending = (async () => {
      const started = timer(), at = now();
      const queries = [
        admin.from('drivers').select('id', { count: 'exact', head: true }).eq('is_online', true),
        admin.from('rides').select('id', { count: 'exact', head: true }).in('status', ['accepted', 'arrived', 'in_progress']),
        admin.from('rides').select('id', { count: 'exact', head: true }).eq('status', 'searching'),
        admin.from('rides').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', new Date(at - 3600000).toISOString()),
      ];
      const results = await Promise.all(queries);
      const counts = results.map(result => {
        if (result.error || !Number.isInteger(result.count) || result.count < 0) throw new Error('Les mesures d’activité sont momentanément indisponibles.');
        return result.count;
      });
      snapshot = {
        sampledAt: new Date(at).toISOString(),
        driversOnline: counts[0], activeRides: counts[1], searchingRides: counts[2], completedLastHour: counts[3],
        activityQueryMs: Math.max(0, Math.round(timer() - started)),
        connectedClients: null,
        infrastructure: { cpuPercent: null, memoryPercent: null, capacityPercent: null },
        objectives: { drivers: 500, clients: 10000 },
      };
      sampledAt = at;
      return snapshot;
    })();
    try { return await pending; } finally { pending = null; }
  };
}
export const readSiteActivity = createActivityReader();
