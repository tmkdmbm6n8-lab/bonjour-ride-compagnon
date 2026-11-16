/** Interpolate heading by the shortest turn, including north (359° → 1°). */
export function interpolateHeading(from, to, progress) {
  const delta = ((to - from + 540) % 360) - 180;
  return (((from + delta * progress) % 360) + 360) % 360;
}

/** Animate between actual GPS fixes; never extrapolate a vehicle ahead of its fix. */
export function interpolateFix(from, to, progress) {
  return {
    lat: from.lat + (to.lat - from.lat) * progress,
    lng: from.lng + (to.lng - from.lng) * progress,
    heading: interpolateHeading(from.heading || 0, to.heading || 0, progress),
  };
}
