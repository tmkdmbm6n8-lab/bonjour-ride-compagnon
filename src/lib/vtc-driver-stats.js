import { mondayOf, parisDay, parisInstant, shiftDay } from './vtc-dates';
export function driverWeekSummary(rides, day = parisDay(), now = new Date()) {
  const start = mondayOf(day), end = shiftDay(start, 7);
  const byDay = Array.from({ length: 7 }, (_, index) => ({ _id: shiftDay(start, index), earnings: 0, trips: 0, activitySeconds: 0 }));
  const boundaries = new Map(byDay.map((row) => [row._id, [Date.parse(parisInstant(row._id)), Date.parse(parisInstant(shiftDay(row._id, 1)))]]));
  const completed = rides.filter((ride) => ride.status === 'completed' && !ride.is_test);
  for (const ride of completed) {
    if (!ride.completed_at || !Number.isFinite(Date.parse(ride.completed_at))) continue;
    const row = byDay.find((d) => d._id === parisDay(ride.completed_at));
    if (row) { row.earnings += Number(ride.fare?.driverEarnings) || 0; row.trips++; }
    const until = Date.parse(ride.completed_at);
    const measured = Number.isFinite(ride.fare?.activitySeconds) ? Math.max(0, ride.fare.activitySeconds) : null;
    const accepted = Date.parse(ride.accepted_at || '');
    const since = Number.isFinite(accepted) ? accepted : measured !== null ? until - measured * 1000 : until;
    const elapsed = Math.max(0, (until - since) / 1000);
    const actual = measured ?? elapsed;
    for (const bucket of byDay) {
      const [from, to] = boundaries.get(bucket._id);
      const overlap = Math.max(0, Math.min(until, to) - Math.max(since, from)) / 1000;
      bucket.activitySeconds += elapsed ? Math.round(actual * overlap / elapsed) : 0;
    }
  }
  for (const row of byDay) row.earnings = Math.round(row.earnings * 100) / 100;
  const sum = (key) => byDay.reduce((total, row) => total + row[key], 0);
  return { start, end, total: Math.round(sum('earnings') * 100) / 100, trips: sum('trips'), activitySeconds: sum('activitySeconds'), byDay, today: byDay.find((row) => row._id === parisDay(now)) || { earnings: 0, trips: 0, activitySeconds: 0 }, fromUtc: parisInstant(start), toUtc: parisInstant(end) };
}