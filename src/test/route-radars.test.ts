import { describe, expect, it } from 'vitest';
import { radarsOnRoute, routeBounds } from '@/lib/route-radars';
import { remainingRoute } from '@/lib/utils/route-display';
import { mergeCameraAlerts } from '@/lib/vtc-speed-cameras';

const road = [[7, 48], [7.01, 48], [7.02, 48]];
const radar = (id: string, lng: number, lat = 48) => ({ id, lng, lat, kind: 'radar' });

describe('radars until arrival', () => {
  it('counts radars on the road, excluding other roads and police', () => {
    const cameras = [radar('a', 7.005), radar('b', 7.015), radar('other-road', 7.01, 48.002), { ...radar('police', 7.008), kind: 'police' }];
    expect(radarsOnRoute(cameras, road).map(c => c.id)).toEqual(['a', 'b']);
  });
  it('decreases after passing a radar, including one less than 50 m behind', () => {
    const cameras = [radar('a', 7.005), radar('b', 7.015)];
    const remaining = remainingRoute(road, { lng: 7.0051, lat: 48 }).geometry;
    expect(radarsOnRoute(cameras, remaining).map(c => c.id)).toEqual(['b']);
    expect(radarsOnRoute(cameras, remainingRoute(road, { lng: 7.02, lat: 48 }).geometry)).toEqual([]);
  });
  it('excludes radars before departure and beyond arrival', () => {
    expect(radarsOnRoute([radar('before', 6.9999), radar('after', 7.0201)], road)).toEqual([]);
  });
  it('counts repeated IDs and manual/official duplicates only once', () => {
    const a = radar('a', 7.005);
    expect(radarsOnRoute([a, a], road)).toHaveLength(1);
    expect(radarsOnRoute(mergeCameraAlerts([a], [radar('official', 7.0051)]), road)).toHaveLength(1);
  });
  it('covers the whole road even on long trips', () => {
    expect(routeBounds([[2, 45], [7, 48]])).toEqual([1.99, 44.99, 7.01, 48.01]);
    expect(routeBounds(null)).toBeNull();
    expect(radarsOnRoute([], null)).toEqual([]);
  });
});
