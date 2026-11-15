export const PARIS_TIMEZONE = 'Europe/Paris';
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export function parisDay(value = new Date()) {
  return dayFormatter.format(new Date(value));
}
export function validDay(day) { return /^\d{4}-\d{2}-\d{2}$/.test(day || '') && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day; }
export function shiftDay(day, offset) { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); }
export function mondayOf(day) { const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); return shiftDay(day, -((dow + 6) % 7)); }
export function parisInstant(day, seconds = 0) {
  const logical = new Date(Date.parse(`${day}T00:00:00Z`) + seconds * 1000);
  const expected = logical.toISOString().slice(0, 19);
  for (const offset of [2, 1]) {
    const date = new Date(logical.getTime() - offset * 3600000);
    const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: PARIS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date).replace(' ', 'T');
    if (parts === expected) return date.toISOString();
  }
  return null; // Nonexistent local time on the spring DST transition.
}
export function clock(value) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS_TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'; }
export function workDuration(seconds) { const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60); return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`; }