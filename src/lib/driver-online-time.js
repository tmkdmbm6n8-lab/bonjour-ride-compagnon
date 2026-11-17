import { parisDay, parisInstant, shiftDay } from './vtc-dates.js';

// Only server-observed online time is counted. Long network gaps are not invented.
export function advanceOnlineTime(previous = {}, wasOnline, online, now = Date.now()) {
  const cutoff = shiftDay(parisDay(now), -365);
  const days = Object.fromEntries(Object.entries(previous.days || {}).filter(([day]) => day >= cutoff));
  const last = Date.parse(previous.lastSeen || '');
  if (wasOnline && Number.isFinite(last) && now >= last && now - last <= 120000) {
    let cursor = last;
    while (cursor < now) {
      const day = parisDay(cursor);
      const end = Math.min(now, Date.parse(parisInstant(shiftDay(day, 1))));
      days[day] = (Number(days[day]) || 0) + (end - cursor) / 1000;
      cursor = end;
    }
  }
  return { days, lastSeen: online ? new Date(now).toISOString() : null };
}
