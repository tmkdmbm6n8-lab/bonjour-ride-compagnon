/** Known radars within 50 m of the remaining road; endpoints exclude passed cameras. */
export function radarsOnRoute(cameras, geometry) {
  if (!geometry || geometry.length < 2) return [];
  const seen = new Set();
  return cameras.filter(camera => {
    if (camera.kind !== 'radar' || !Number.isFinite(camera.lat) || !Number.isFinite(camera.lng) || seen.has(camera.id)) return false;
    let best = null;
    const scale = Math.cos(camera.lat * Math.PI / 180);
    for (let i = 0; i < geometry.length - 1; i++) {
      const a = geometry[i], b = geometry[i + 1];
      const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
      const length = dx * dx + dy * dy;
      if (!length) continue;
      const px = (camera.lng - a[0]) * scale, py = camera.lat - a[1];
      const raw = (px * dx + py * dy) / length;
      const t = Math.max(0, Math.min(1, raw));
      const distance = Math.hypot(px - t * dx, py - t * dy) * 111320;
      if (!best || distance < best.distance) best = { distance, raw, i };
    }
    if (!best || best.distance > 50 || (best.i === 0 && best.raw < 0) ||
        (best.i === geometry.length - 2 && best.raw > 1)) return false;
    seen.add(camera.id);
    return true;
  });
}

export function routeBounds(geometry) {
  if (!geometry || geometry.length < 2) return null;
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lng, lat] of geometry) {
    bounds[0] = Math.min(bounds[0], lng); bounds[1] = Math.min(bounds[1], lat);
    bounds[2] = Math.max(bounds[2], lng); bounds[3] = Math.max(bounds[3], lat);
  }
  return [Math.max(-180, bounds[0] - .01), Math.max(-90, bounds[1] - .01),
    Math.min(180, bounds[2] + .01), Math.min(90, bounds[3] + .01)];
}
