import { parisDay, validDay, shiftDay } from './vtc-dates';
import { parseAirportBoard, parseTrainSchedule, mergeTrainRealtime, AIRPORT } from './vtc-transport';
import { haversineDistance } from './utils/geo';
import { airportReturnHint } from './vtc-opportunities';
const cache = new Map();
async function cached(key, ttl, load) {
  const old = cache.get(key);
  if (old && old.until > Date.now()) return old.promise;
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  const entry = { until: Date.now() + ttl, promise: null };
  entry.promise = load().catch((error) => { if (cache.get(key) === entry) cache.delete(key); throw error; });
  cache.set(key, entry); return entry.promise;
}
async function get(url, json = true, headers = {}) {
  const response = await fetch(url, { headers: { 'User-Agent': 'StrasDrive/1.0', ...headers }, signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error('Source momentanément indisponible');
  return json ? response.json() : response.text();
}
export async function flightsForDay(day) {
  return cached(`flights:${day}`, 60000, async () => {
    const fetchedAt = new Date().toISOString();
    // The airport splits already operated flights (histo=1) from upcoming flights.
    const source = await cached('airport-public-pages', 60000, async () => {
      const results = await Promise.allSettled([
        get('https://www.strasbourg.aeroport.fr/app/data.php?temps_reel=arrivee&histo=1', false),
        get('https://www.strasbourg.aeroport.fr/app/data.php?temps_reel=arrivee', false),
      ]);
      const pages = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
      if (!pages.length) throw new Error('Tableau aéroport indisponible');
      return { pages, partial: pages.length < 2 };
    });
    const items = [...new Map(source.pages.flatMap((html) => parseAirportBoard(html, day, fetchedAt)).map((item) => [item.id, item])).values()];
    if (!items.length && source.pages.every((html) => !html.includes('all_vols'))) throw new Error('Format aéroport indisponible');
    return { items, source: 'Aéroport de Strasbourg', sourceUrl: 'https://www.strasbourg.aeroport.fr/passagers/voyager/vols-du-jour-en-temps-reel/', fetchedAt, warning: items.length ? source.partial ? 'Une partie du tableau aéroport est indisponible ; les vols accessibles restent affichés.' : 'Tableau public : certains détails ne sont pas publiés par l’aéroport.' : 'L’aéroport ne publie pas les horaires de cette date dans son tableau public actuel.' };
  });
}
export async function trainsForDay(day) {
  const schedule = await cached('train-schedule', 3600000, () => get('https://api.trainnomade.fr/gares/horaires/gare-de-strasbourg.json'));
  let items = parseTrainSchedule(schedule, day), warning = '', liveAt = null;
  if (day === parisDay()) {
    try {
      const live = await cached('train-live', 60000, () => get('https://api.trainnomade.fr/gare/87212027.json'));
      items = mergeTrainRealtime(items, live, day);
      if (Date.parse(live.perime_apres) <= Date.now()) warning = 'Temps réel ferroviaire indisponible : horaires prévus affichés.';
      liveAt = live.donnee_du || live.collecte_le;
    } catch { warning = 'Temps réel ferroviaire indisponible : horaires prévus affichés.'; }
  } else warning = 'Horaires prévus ; les retards et voies seront disponibles lorsqu’ils seront publiés.';
  if (day < schedule.du || day > schedule.au) warning = `Horaires SNCF publiés du ${schedule.du} au ${schedule.au} uniquement.`;
  return { items, source: 'SNCF · Train Nomade · ODbL', sourceUrl: 'https://trainnomade.fr/api/', fetchedAt: new Date().toISOString(), liveAt, warning };
}
export async function discoverBoard(day = parisDay()) {
  if (!validDay(day) || Math.abs(Date.parse(day) - Date.parse(parisDay())) > 366 * 86400000) throw new Error('Date invalide');
  const results = await Promise.allSettled([flightsForDay(day), trainsForDay(day)]);
  const feeds = results.map((result, i) => result.status === 'fulfilled' ? { kind: i ? 'train' : 'flight', available: true, ...result.value } : { kind: i ? 'train' : 'flight', items: [], available: false, warning: i ? 'Source ferroviaire indisponible. Réessayez dans un instant.' : 'Source aérienne indisponible. Réessayez dans un instant.' });
  return { day, fetchedAt: new Date().toISOString(), items: feeds.flatMap((feed) => feed.items).sort((a, b) => Date.parse(a.estimated || a.scheduled) - Date.parse(b.estimated || b.scheduled)), feeds: feeds.map(({ items, ...metadata }) => metadata) };
}
export async function returnHintForRide(ride, approachSeconds, routeBetween) {
  if (ride.is_test || !Number.isFinite(ride.dropoff?.lat) || !Number.isFinite(ride.dropoff?.lng)) return null;
  const distance = haversineDistance(ride.dropoff.lat, ride.dropoff.lng, AIRPORT.lat, AIRPORT.lng);
  if (distance > 20) return null;
  const request = (async () => {
  try {
    let road = null;
    if (distance > 5) road = await cached(`airport-road:${ride.dropoff.lat.toFixed(4)},${ride.dropoff.lng.toFixed(4)}`, 600000, () => routeBetween(ride.dropoff, AIRPORT));
    if (distance > 5 && (!road || road.approximate || road.durationSeconds > 300)) return null;
    const flights = await flightsForDay(parisDay());
    return airportReturnHint(ride, flights.items, { approachSeconds, airportTravelSeconds: road?.durationSeconds || 0, nearAirport: distance <= 5 || Boolean(road && !road.approximate && road.durationSeconds <= 300) });
  } catch { return null; }
  })();
  let timer;
  try { return await Promise.race([request, new Promise((resolve) => { timer = setTimeout(() => resolve(null), 1200); })]); } finally { clearTimeout(timer); }
}