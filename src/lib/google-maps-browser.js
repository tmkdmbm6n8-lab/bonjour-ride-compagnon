let loading;

/** Browser-only key, restricted by HTTP referrer. Never reuse the server connector key. */
export function loadGoogleMaps() {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  const key =
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ||
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error("La carte Google Maps n’est pas encore configurée."));
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const callback = `strasdriveMapsReady${Date.now()}`;
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      delete window[callback];
      if (error) {
        script.remove();
        reject(error);
      } else resolve(window.google.maps);
    };
    const timer = setTimeout(
      () => finish(new Error("Google Maps ne répond pas. Réessayez.")),
      20000,
    );
    window[callback] = () => finish();
    script.onerror = () => finish(new Error("Impossible de charger Google Maps."));
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, v: "weekly", language: "fr", region: "FR", loading: "async", callback })}`;
    script.async = true;
    document.head.appendChild(script);
  }).catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

/** HTML markers keep the existing driver, pickup and radar icons on Google's map. */
export function createHtmlMarker(maps, map, position, node) {
  class HtmlMarker extends maps.OverlayView {
    onAdd() {
      this.getPanes().overlayMouseTarget.appendChild(node);
    }
    draw() {
      const point = this.getProjection().fromLatLngToDivPixel(new maps.LatLng(position));
      if (!point) return;
      node.style.position = "absolute";
      node.style.left = `${point.x}px`;
      node.style.top = `${point.y}px`;
      node.style.transform = "translate(-50%, -50%)";
    }
    onRemove() {
      node.remove();
    }
  }
  const overlay = new HtmlMarker();
  overlay.setMap(map);
  return {
    setPosition(next) {
      position = next;
      if (overlay.getProjection()) overlay.draw();
    },
    remove: () => overlay.setMap(null),
  };
}

/** Adapter used only by the existing viewport-based radar hook. */
export function cameraViewport(map, maps) {
  const listeners = new Map();
  return {
    getBounds() {
      const b = map.getBounds();
      return {
        getWest: () => b?.getSouthWest().lng() ?? 0,
        getSouth: () => b?.getSouthWest().lat() ?? 0,
        getEast: () => b?.getNorthEast().lng() ?? 0,
        getNorth: () => b?.getNorthEast().lat() ?? 0,
      };
    },
    getZoom: () => map.getZoom() ?? 0,
    on(event, handler) {
      const key = `${event}`;
      if (!listeners.has(handler)) listeners.set(handler, new Map());
      listeners
        .get(handler)
        .set(key, maps.event.addListener(map, event === "load" ? "tilesloaded" : "idle", handler));
    },
    off(event, handler) {
      listeners.get(handler)?.get(event)?.remove();
      listeners.get(handler)?.delete(event);
    },
  };
}
