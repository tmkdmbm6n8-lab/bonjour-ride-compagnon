// Display helpers shared by rider and driver ride screens.

/** Only real road geometry is drawn: an approximate route (null) or a bare 2-point segment is never shown as a line. */
export function drawableRoute(geometry) {
  return Array.isArray(geometry) && geometry.length > 2 ? geometry : undefined;
}

/** Project GPS onto the road and keep only the remaining portion. Ignore off-road fixes. */
export function remainingRoute(geometry, position, minimumProgress = 0) {
  if (!Array.isArray(geometry) || geometry.length < 2 || !Number.isFinite(position?.lat) || !Number.isFinite(position?.lng)) {
    return { geometry, progress: minimumProgress };
  }
  const scale = Math.cos(position.lat * Math.PI / 180);
  let best = null;
  for (let i = Math.floor(minimumProgress); i < geometry.length - 1; i++) {
    const a = geometry[i], b = geometry[i + 1];
    const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
    const px = (position.lng - a[0]) * scale, py = position.lat - a[1];
    const length = dx * dx + dy * dy;
    const t = Math.max(i === Math.floor(minimumProgress) ? minimumProgress - i : 0,
      Math.min(1, length ? (px * dx + py * dy) / length : 0));
    const distance = Math.hypot(px - t * dx, py - t * dy) * 111320;
    // Prefer the earlier segment at crossings rather than jumping ahead.
    if (!best || distance < best.distance - 1) best = { i, t, distance };
  }
  if (!best || best.distance > 75) {
    const i = Math.min(Math.floor(minimumProgress), geometry.length - 2);
    const t = minimumProgress - i;
    const a = geometry[i], b = geometry[i + 1];
    return { geometry: [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ...geometry.slice(i + 1)], progress: minimumProgress };
  }
  const { i, t } = best;
  const a = geometry[i], b = geometry[i + 1];
  return {
    geometry: [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ...geometry.slice(i + 1)],
    progress: i + t,
  };
}

/** Clock time ("14:32") reached after `seconds` from now. */
export function arrivalClock(seconds, now = new Date()) {
  const at = new Date(now.getTime() + Math.max(0, Number(seconds) || 0) * 1000);
  return at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
}
