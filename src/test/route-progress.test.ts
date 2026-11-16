import { describe, expect, it } from 'vitest';
import { remainingRoute } from '@/lib/utils/route-display';

describe('driver route progress', () => {
  const road = [[7, 48], [7.001, 48], [7.002, 48], [7.003, 48]];

  it('erases the travelled road, including part of a segment', () => {
    const result = remainingRoute(road, { lng: 7.0015, lat: 48 });
    expect(result.progress).toBeCloseTo(1.5);
    expect(result.geometry).toEqual([[7.0015, 48], [7.002, 48], [7.003, 48]]);
    expect(road).toHaveLength(4);
  });

  it('does not restore travelled road when GPS moves backwards', () => {
    const result = remainingRoute(road, { lng: 7.0014, lat: 48 }, 1.5);
    expect(result.progress).toBe(1.5);
    expect(result.geometry[0][0]).toBeCloseTo(7.0015);
  });

  it('ignores a distant GPS fix and preserves existing progress', () => {
    const result = remainingRoute(road, { lng: 8, lat: 49 }, 1.5);
    expect(result.progress).toBe(1.5);
    expect(result.geometry[0][0]).toBeCloseTo(7.0015);
  });

  it('retains the route until GPS is available', () => {
    expect(remainingRoute(road, null).geometry).toBe(road);
    expect(remainingRoute(null, { lng: 7, lat: 48 }).geometry).toBeNull();
  });

  it('keeps the final road segment visible and reaches the destination', () => {
    expect(remainingRoute(road, { lng: 7.0025, lat: 48 }).geometry).toHaveLength(2);
    expect(remainingRoute(road, { lng: 7.003, lat: 48 }).progress).toBe(3);
  });

  it('prefers the first passage at a crossing', () => {
    const loop = [[7, 48], [7.001, 48], [7.001, 48.001], [7, 48], [7.002, 48]];
    expect(remainingRoute(loop, { lng: 7, lat: 48 }).progress).toBe(0);
  });
});
