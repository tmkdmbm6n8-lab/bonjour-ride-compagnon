import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { estimates } from '@/lib/vtc.server';
const pickup = {lat:48.594205,lng:7.69879};
const dropoff = {lat:48.543527,lng:7.494043};
function database(rows: any[] = []) {
  const filter = vi.fn().mockResolvedValue({ data: rows, error: null });
  const select = vi.fn(() => ({ in: filter }));
  return { from: vi.fn(() => ({ select })), filter };
}
describe('pipeline commun des devis et réservations', () => {
  beforeEach(() => {
    vi.stubEnv('LOVABLE_API_KEY','test-connector-token');
    vi.stubEnv('GOOGLE_MAPS_API_KEY','test-map-key');
    vi.stubGlobal('fetch',vi.fn(async (url: string) => {
      if (!String(url).startsWith('https://connector-gateway.lovable.dev/google_maps/routes/')) throw new Error('Unexpected external request');
      return Response.json({routes:[{distanceMeters:20513.6,duration:'1550.1s',staticDuration:'1550.1s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'}}]});
    }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('renvoie les quatre tarifs réels avec seulement une requête de calcul d’itinéraire', async () => {
    const db=database([{vehicle_type:'economy',rule:{baseFare:99,perKmRate:99}},{vehicle_type:'legacy_learning_config',rule:{enabled:true}}]);
    const quote=await estimates(db,pickup,dropoff);
    expect(quote.pricingMode).toBe('tariff');
    expect(Object.fromEntries(Object.entries(quote.estimates).map(([key,fare]:any)=>[key,fare.total]))).toEqual({economy:29.70,comfort:38.04,pet:33.70,xl:50.15});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(db.from).toHaveBeenCalledWith('pricing_rules');
    expect(db.filter).toHaveBeenCalledWith('vehicle_type',['economy','comfort','pet','xl']);
  });
  it('renvoie les minimums avec centimes dans les quatre devis serveur', async () => {
    vi.stubGlobal('fetch',vi.fn(async () => Response.json({routes:[{distanceMeters:100,duration:'30s',staticDuration:'30s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'}}]})));
    const quote=await estimates(database(),pickup,dropoff);
    expect(Object.fromEntries(Object.entries(quote.estimates).map(([key,fare]:any)=>[key,fare.total]))).toEqual({economy:11.98,comfort:17.98,pet:15.98,xl:15.98});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('refuse les coordonnées invalides avant tout devis', async () => {
    await expect(estimates(database(),{lat:NaN,lng:7},dropoff)).rejects.toThrow('Adresses invalides');
    expect(fetch).not.toHaveBeenCalled();
  });
});
