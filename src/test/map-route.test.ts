import { describe, expect, it, vi } from 'vitest';
import { drawRoute } from '@/lib/map-route';
import { drawableRoute } from '@/lib/utils/route-display';

function mapFixture() {
  const sources = new Map();
  const layers = new Map();
  return {
    sources, layers,
    isStyleLoaded: vi.fn(() => true),
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource: vi.fn((id: string, data: any) => sources.set(id, { ...data, setData: vi.fn() })),
    addLayer: vi.fn((layer: any) => layers.set(layer.id, layer)),
  };
}

describe('route rendering during an active ride', () => {
  const geometry = [[7, 48], [7.001, 48], [7.002, 48]];

  it('restores the visible line when only the source exists', () => {
    const map = mapFixture();
    map.sources.set('route', { setData: vi.fn() });
    expect(drawRoute(map, geometry)).toBe(true);
    expect(map.layers.get('route-line')).toMatchObject({ type: 'line', source: 'route' });
    expect(map.layers.size).toBe(4);
  });

  it('retries after an incomplete layer installation', () => {
    const map = mapFixture();
    map.addLayer.mockImplementationOnce(() => { throw new Error('style changing'); });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(drawRoute(map, geometry)).toBe(false);
    expect(drawRoute(map, geometry)).toBe(true);
    expect(map.layers.has('route-line')).toBe(true);
    warning.mockRestore();
  });

  it('waits for the style and restores the route after style replacement', () => {
    const map = mapFixture();
    map.isStyleLoaded.mockReturnValueOnce(false);
    expect(drawRoute(map, geometry)).toBe(false);
    expect(drawRoute(map, geometry)).toBe(true);
    map.sources.clear();
    map.layers.clear();
    expect(drawRoute(map, geometry)).toBe(true);
    expect(map.addSource).toHaveBeenCalledTimes(2);
    expect(map.layers.has('route-line')).toBe(true);
  });

  it('does not repeatedly update the source on idle events', () => {
    const map = mapFixture();
    drawRoute(map, geometry);
    drawRoute(map, geometry);
    expect(map.sources.get('route').setData).not.toHaveBeenCalled();
    const remaining = geometry.slice(1);
    drawRoute(map, remaining);
    expect(map.sources.get('route').setData).toHaveBeenCalledTimes(1);
    expect(map.sources.get('route').setData.mock.calls[0][0].features[0].geometry.coordinates).toEqual(remaining);
  });

  it('draws short road routes returned by a routing service', () => {
    const short = geometry.slice(1);
    expect(drawableRoute(short, 'google')).toBe(short);
    expect(drawableRoute(short, 'osrm')).toBe(short);
    expect(drawableRoute(short, 'estimate')).toBeUndefined();
    expect(drawableRoute([[NaN, 48], [7, 48]], 'google')).toBeUndefined();
  });
});
