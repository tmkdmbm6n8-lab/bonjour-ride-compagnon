import { parisInstant, shiftDay, validDay } from './vtc-dates.js';
export function adminRideDateRange(day) {
  if (!validDay(day)) throw new Error('Date invalide');
  return { from: parisInstant(day), to: parisInstant(shiftDay(day,1)) };
}
export function recordPerson(profile) {
  return profile ? { id:profile.id, name:profile.name || '', phone:profile.phone || '', username:profile.username || '' } : null;
}
