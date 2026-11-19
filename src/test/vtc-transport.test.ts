import { describe, expect, it } from 'vitest';
import { parseAirportBoard, parseTrainSchedule, mergeTrainRealtime, transportChanges } from '@/lib/vtc-transport';
import { airportReturnHint, stationReturnHint } from '@/lib/vtc-opportunities';
const fetched = '2026-11-15T10:00:00Z';
const airport = `<div class="depart all_vols"><div class="vol " data-date="2026-11-15 12:00:00"><div class="destination"><p>PARIS</p></div><p id='numvol'>V7 1</p><span id='status'>ANNULÉ</span></div></div><div class="arrivee all_vols show"><div class="vol " data-date="2026-11-15 11:30:00"><div class="destination"><p>NICE</p></div><p id='numvol'>V7 2</p><span id='status'>PRÉVU 11:50</span></div><div class="vol " data-date="2026-11-15 11:00:00"><div class="destination"><p>LYON</p></div><p id='numvol'>V7 3</p><span id='status'>ARRIVÉ À 11:05</span></div></div>`;
const schedule = { du: '2026-11-15', au: '2026-11-28', produits: ['TER', 'Car TER'], familles: ['TER', 'CAR'], trains: [['123', 0, 'Colmar', 'Strasbourg', 660, null, 1], ['456', 0, 'Strasbourg', 'Paris', null, 720, 2], ['999', 1, 'Kehl', 'Strasbourg', 600, null, 1]] };
describe('horaires gratuits vols et trains', () => {
  it('distingue les arrivées et départs, les retards, annulations et heures constatées', () => {
    const items = parseAirportBoard(airport, '2026-11-15', fetched);
    expect(items).toHaveLength(3);
    expect(items.find((item) => item.number === 'V7 1')?.status).toBe('cancelled');
    expect(items.find((item) => item.number === 'V7 2')?.estimated).toBe('2026-11-15T10:50:00.000Z');
    expect(items.find((item) => item.number === 'V7 2')?.status).toBe('delayed');
    expect(items.find((item) => item.number === 'V7 3')?.actual).toBe('2026-11-15T10:05:00.000Z');
  });
  it('ne montre pas de vols de la mauvaise date', () => {
    expect(parseAirportBoard(airport, '2026-11-16', fetched)).toEqual([]);
  });
  it('respecte les jours de circulation et exclut les autocars TER', () => {
    const first = parseTrainSchedule(schedule, '2026-11-15');
    expect(first.map((item: any) => item.number)).toEqual(['123']);
    expect(first[0].live).toBe(false);
    expect(parseTrainSchedule(schedule, '2026-11-16')[0].number).toBe('456');
    expect(parseTrainSchedule(schedule, '2026-12-15')).toEqual([]);
  });
  it('combine horaire prévu, retard, voie et annulation du flux vivant', () => {
    const before = parseTrainSchedule(schedule, '2026-11-15');
    const merged = mergeTrainRealtime(before, { jour: '2026-11-15', perime_apres: '2026-11-15T11:00:00Z', collecte_le: fetched, noms: { COL: 'Colmar' }, passages: [{ n: '123', a: 39600, ra: 600, v: '4', o: 'COL' }] }, '2026-11-15', Date.parse(fetched));
    expect(merged).toHaveLength(1); expect(merged[0].status).toBe('delayed'); expect(merged[0].platform).toBe('4');
    const cancelled = mergeTrainRealtime(before, { jour: '2026-11-15', perime_apres: '2026-11-15T11:00:00Z', passages: [{ n: '123', a: 39600, an: 1 }] }, '2026-11-15', Date.parse(fetched));
    expect(cancelled[0].status).toBe('cancelled');
  });
  it('ne transforme pas un flux périmé en temps réel confirmé', () => {
    const before = parseTrainSchedule(schedule, '2026-11-15');
    expect(mergeTrainRealtime(before, { jour: '2026-11-15', perime_apres: '2026-11-15T09:00:00Z', passages: [{ n: '123', a: 39600, ra: 600 }] }, '2026-11-15', Date.parse(fetched))).toEqual(before);
  });
  it('signale les changements de statut, horaire et voie sans bruit lié au seul rafraîchissement', () => {
    const old = [{ id: 'train:1', status: 'published', platform: '1', updatedAt: fetched }];
    expect(transportChanges(old, [{ ...old[0], updatedAt: 'new' }])).toEqual([]);
    expect(transportChanges(old, [{ ...old[0], platform: '2' }])).toHaveLength(1);
  });
});
describe('retour potentiel près de SXB', () => {
  const ride = { route: { durationSeconds: 1200 }, is_test: false };
  const now = Date.parse(fetched);
  const flight = { kind: 'flight', direction: 'arrival', live: true, status: 'published', number: 'V7 123', city: 'NICE', scheduled: '2026-11-15T10:40:00Z', updatedAt: fetched, statusText: 'À l’heure', source: 'Aéroport de Strasbourg' };
  it('affiche un retour potentiel pour une arrivée compatible, jamais un revenu garanti', () => {
    const hint = airportReturnHint(ride, [flight], { now, nearAirport: true, approachSeconds: 300 });
    expect(hint?.flightNumber).toBe('V7 123'); expect(hint?.message).toContain('sans garantie');
  });
  it('ignore les départs, annulations, données anciennes et vols trop éloignés dans le temps', () => {
    for (const update of [{ direction: 'departure' }, { status: 'cancelled' }, { updatedAt: '2026-11-15T08:00:00Z' }, { scheduled: '2026-11-15T15:00:00Z' }]) {
      expect(airportReturnHint(ride, [{ ...flight, ...update }], { now, nearAirport: true })).toBeNull();
    }
  });
  it('n’alerte ni hors de la zone ni sur une course fictive', () => {
    expect(airportReturnHint(ride, [flight], { now, nearAirport: false })).toBeNull();
    expect(airportReturnHint({ ...ride, is_test: true }, [flight], { now, nearAirport: true })).toBeNull();
  });
  it('tient compte de la nouvelle estimation après un retard', () => {
    expect(airportReturnHint(ride, [{ ...flight, estimated: '2026-11-15T15:00:00Z' }], { now, nearAirport: true })).toBeNull();
  });
});

describe("opportunité Gold d’un retour en gare", () => {
  it("utilise une arrivée de train en direct et exclut les horaires théoriques", () => {
    const now = Date.parse("2026-11-15T12:00:00Z");
    const ride = { route: { durationSeconds: 600 } };
    const train = { kind: "train", direction: "arrival", number: "9591", live: true,
      updatedAt: new Date(now).toISOString(), estimated: "2026-11-15T12:20:00Z", status: "published" };
    expect(stationReturnHint(ride, [train], { nearAirport: true, now })).toMatchObject({ kind: "train", flightNumber: "9591" });
    expect(stationReturnHint(ride, [{ ...train, live: false }], { nearAirport: true, now })).toBeNull();
  });
});
