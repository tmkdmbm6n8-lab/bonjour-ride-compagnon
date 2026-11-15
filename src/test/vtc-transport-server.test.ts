import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const future = `<div class="arrivee all_vols"><div class="vol " data-date="2026-11-15 12:00:00"><div class="destination"><p>NICE</p></div><p id='numvol'>V7 2</p><span id='status'>à l'heure</span></div></div>`;
const history = `<div class="arrivee all_vols"><div class="vol " data-date="2026-11-15 10:00:00"><div class="destination"><p>LYON</p></div><p id='numvol'>V7 1</p><span id='status'>ARRIVÉ À 10:05</span></div></div>`;
beforeEach(() => { vi.resetModules(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-15T10:00:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function mockSource(failHistory = false) {
  const fetcher = vi.fn(async (url: string) => {
    if (failHistory && url.includes('histo=1')) throw new Error('Source history offline');
    return { ok: true, text: async () => url.includes('histo=1') ? history : future };
  });
  vi.stubGlobal('fetch', fetcher); return fetcher;
}
describe('source aéroport gratuite complète pour le jour publié', () => {
  it('combine historique et vols à venir, au lieu de ne garder que les vols déjà arrivés', async () => {
    const fetcher = mockSource(); const { flightsForDay } = await import('@/lib/vtc-transport.server');
    const board = await flightsForDay('2026-11-15');
    expect(board.items.map((item: any) => item.number)).toEqual(['V7 1', 'V7 2']);
    expect(board.items[0].actual).toBeTruthy(); expect(board.items[1].actual).toBeNull();
    await flightsForDay('2026-11-15'); expect(fetcher).toHaveBeenCalledTimes(2);
    for (const call of fetcher.mock.calls) expect(new URL(call[0]).hostname).toBe('www.strasbourg.aeroport.fr');
  });
  it('conserve les vols disponibles si une des deux vues publiques tombe en panne', async () => {
    mockSource(true); const { flightsForDay } = await import('@/lib/vtc-transport.server');
    const board = await flightsForDay('2026-11-15');
    expect(board.items.map((item: any) => item.number)).toEqual(['V7 2']); expect(board.warning).toContain('Une partie');
  });
  it('ne prétend pas connaître les horaires d’une date non publiée', async () => {
    mockSource(); const { flightsForDay } = await import('@/lib/vtc-transport.server');
    const board = await flightsForDay('2026-11-20'); expect(board.items).toEqual([]); expect(board.warning).toContain('ne publie pas');
  });
  it('valide le rayon de cinq kilomètres sans appel routier supplémentaire', async () => {
    mockSource(); const route = vi.fn(); const { returnHintForRide } = await import('@/lib/vtc-transport.server');
    const hint = await returnHintForRide({ dropoff: { lat: 48.54, lng: 7.63 }, route: { durationSeconds: 1200 } }, 0, route);
    expect(hint?.flightNumber).toBe('V7 2'); expect(route).not.toHaveBeenCalled();
  });
  it('valide le seuil de cinq minutes avec un vrai itinéraire hors du rayon', async () => {
    mockSource(); const route = vi.fn().mockResolvedValue({ durationSeconds: 299, source: 'osrm', approximate: false });
    const { returnHintForRide } = await import('@/lib/vtc-transport.server');
    const hint = await returnHintForRide({ dropoff: { lat: 48.6, lng: 7.62 }, route: { durationSeconds: 1200 } }, 0, route);
    expect(hint?.flightNumber).toBe('V7 2'); expect(route).toHaveBeenCalledTimes(1);
  });
  it('ne valide pas les cinq minutes à partir d’une estimation approximative', async () => {
    const fetcher = mockSource(); const route = vi.fn().mockResolvedValue({ durationSeconds: 200, approximate: true });
    const { returnHintForRide } = await import('@/lib/vtc-transport.server');
    expect(await returnHintForRide({ dropoff: { lat: 48.6, lng: 7.62 }, route: { durationSeconds: 1200 } }, 0, route)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});