import { parisDay, parisInstant, shiftDay } from './vtc-dates';
export const AIRPORT = { lat: 48.5385, lng: 7.6282, name: 'Aéroport de Strasbourg · SXB' };
export const STATION = { lat: 48.5851, lng: 7.7346, name: 'Gare de Strasbourg' };
const clean = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
function clockNearScheduled(day, match, scheduled) {
  if (!match) return null;
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60;
  let at = parisInstant(day, seconds);
  const delta = Date.parse(at) - Date.parse(scheduled);
  if (delta < -12 * 3600000) at = parisInstant(shiftDay(day, 1), seconds);
  else if (delta > 12 * 3600000) at = parisInstant(shiftDay(day, -1), seconds);
  return at;
}
export function parseAirportBoard(html, day, fetchedAt) {
  const items = [];
  const sections = [...html.matchAll(/<div class="(depart|arrivee) all_vols[^\"]*">([\s\S]*?)(?=<div class="(?:depart|arrivee) all_vols|<\/div>\s*<\/div>\s*<\/div>\s*$|$)/g)];
  for (const [, section, body] of sections) {
    const direction = section === 'arrivee' ? 'arrival' : 'departure';
    for (const [, localTime, block] of body.matchAll(/<div class="vol[^\"]*" data-date="([^\"]+)">([\s\S]*?)(?=<div class="vol|$)/g)) {
      if (localTime.slice(0, 10) !== day) continue;
      const time = localTime.slice(11, 16).split(':').map(Number);
      const scheduled = parisInstant(day, time[0] * 3600 + time[1] * 60);
      const number = clean(block.match(/id=['"]numvol['"]>([\s\S]*?)<\/p>/)?.[1]);
      if (!number || !scheduled) continue;
      const statusText = clean(block.match(/id=['"]status['"]>([\s\S]*?)<\/span>/)?.[1]);
      const city = clean(block.match(/class="destination"><p>([\s\S]*?)<\/p>/)?.[1]);
      const estimatedClock = statusText.match(/(?:PR[ÉE]VU|RETARD[ÉE]?|ESTIM[ÉE])[\s:]+(\d{1,2})[:h](\d{2})/i);
      const estimated = clockNearScheduled(day, estimatedClock, scheduled);
      const actualClock = statusText.match(/(?:ARRIV[ÉE]|D[ÉE]COLL[ÉE]|PARTI)\s*(?:[ÀA]\s*)?(\d{1,2})[:h](\d{2})/i);
      const actual = clockNearScheduled(day, actualClock, scheduled);
      items.push({ id: `flight:${direction}:${day}:${number}:${scheduled}`, kind: 'flight', direction, number, city, scheduled, estimated, actual, status: /ANNUL|CANCEL|D[ÉE]ROUT/i.test(statusText) ? 'cancelled' : actual ? 'completed' : /RETARD/i.test(statusText) || estimated && Date.parse(estimated) > Date.parse(scheduled) + 60000 ? 'delayed' : 'published', statusText: statusText || 'Statut non publié', carrier: clean(block.match(/images\/comp\/([^".]+)\./)?.[1]).replace(/_/g, ' '), gate: '', platform: '', terminal: '', live: day === parisDay(fetchedAt) && Boolean(statusText), updatedAt: fetchedAt, source: 'Aéroport de Strasbourg' });
    }
  }
  return items;
}
export function parseTrainSchedule(data, day) {
  const offset = Math.round((Date.parse(day) - Date.parse(data.du)) / 86400000);
  if (offset < 0 || offset > 30 || day > data.au) return [];
  return (data.trains || []).flatMap(([number, product, origin, destination, arrival, departure, mask]) => {
    if (!(mask & (1 << offset)) || data.familles?.[product] === 'CAR' || /^car\b|coach|bus/i.test(data.produits?.[product] || '')) return [];
    return [['arrival', arrival], ['departure', departure]].filter(([, value]) => value != null).map(([direction, minutes]) => ({ id: `train:${direction}:${day}:${number}:${minutes}`, kind: 'train', direction, number: String(number), city: direction === 'arrival' ? origin : destination, scheduled: parisInstant(day, minutes * 60), estimated: null, actual: null, status: 'scheduled', statusText: 'Horaire prévu · temps réel non disponible', carrier: data.produits?.[product] || '', platform: '', gate: '', terminal: '', live: false, updatedAt: null, source: 'SNCF · Train Nomade' }));
  });
}
export function mergeTrainRealtime(schedule, data, day, now = Date.now()) {
  const fresh = data?.jour === day && Date.parse(data.perime_apres) > now;
  if (!fresh) return schedule;
  const result = [...schedule];
  for (const passage of data.passages || []) {
    if (/bus|coach|road/i.test(passage.pr || '')) continue;
    for (const [direction, time, delay] of [['arrival', passage.a, passage.ra], ['departure', passage.d, passage.rd]]) {
      if (time == null) continue;
      const scheduled = parisInstant(day, time);
      if (!scheduled || parisDay(scheduled) !== day) continue;
      const existing = result.findIndex((item) => item.direction === direction && item.number === String(passage.n) && Math.abs(Date.parse(item.scheduled) - Date.parse(scheduled)) < 60000);
      const cancelled = Boolean(passage.an || passage.x);
      const live = !passage.nm;
      const item = { ...(result[existing] || {}), id: result[existing]?.id || `train:${direction}:${day}:${passage.n}:${time / 60}`, kind: 'train', direction, number: String(passage.n), scheduled, estimated: live && !cancelled ? parisInstant(day, time + (delay || 0)) : null, actual: null, city: data.noms?.[direction === 'arrival' ? passage.o : passage.de] || result[existing]?.city || '', carrier: result[existing]?.carrier || passage.pr || 'Train', platform: passage.v || '', status: cancelled ? 'cancelled' : !live ? 'scheduled' : (delay || 0) >= 60 ? 'delayed' : 'published', statusText: cancelled ? 'Supprimé' : !live ? 'Horaire prévu · sans suivi temps réel' : delay >= 60 ? `Retard +${Math.round(delay / 60)} min` : passage.p ? direction === 'arrival' ? 'Arrivée constatée' : 'Départ constaté' : 'À l’heure', live, updatedAt: data.donnee_du || data.collecte_le, source: 'SNCF · Train Nomade' };
      if (existing >= 0) result[existing] = item; else result.push(item);
    }
  }
  return result;
}
export function transportChanges(previous, current) {
  const old = new Map(previous.map((item) => [item.id, item]));
  return current.filter((item) => old.has(item.id) && ['status', 'estimated', 'platform', 'gate', 'terminal'].some((field) => (old.get(item.id)[field] || '') !== (item[field] || '')));
}