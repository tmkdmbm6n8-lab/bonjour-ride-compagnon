const rendered = new WeakMap();
const drawing = new WeakSet();
const layers = [
  { id: 'route-line', paint: { 'line-color': '#d4af37', 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 1.5, 13, 2.5, 15, 4, 16, 6, 17, 9, 18, 14, 19, 22, 20, 32, 22, 60], 'line-opacity': 1 } },
];

/** Recover missing layers even when the GeoJSON source already exists. */
export function drawRoute(map, geometry) {
  if (drawing.has(map)) return false;
  drawing.add(map);
  try {
    if (!map.isStyleLoaded()) return false;
    let source = map.getSource('route');
    const previous = rendered.get(map);
    // idle also calls this helper: avoid setData -> render -> idle loops.
    if (!source || previous?.source !== source || previous.geometry !== geometry) {
      const data = {
        type: 'FeatureCollection',
        features: geometry?.length >= 2 ? [{
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: geometry },
        }] : [],
      };
      if (source) source.setData(data);
      else {
        map.addSource('route', { type: 'geojson', data });
        source = map.getSource('route');
      }
      rendered.set(map, { source, geometry });
    }
    for (const layer of layers) {
      if (map.getLayer(layer.id)) continue;
      map.addLayer({ ...layer, type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' } });
    }
    return true;
  } catch (error) {
    console.warn('[MapView] Route rendering failed:', error?.message);
    return false;
  } finally {
    drawing.delete(map);
  }
}
