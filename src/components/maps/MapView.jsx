"use client";

import { useEffect, useRef } from "react";
import { Map as MLMap, Marker, LngLatBounds, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { projectRoute, predictPosition } from "@/lib/navigation-progress";
import { drawRoute } from "@/lib/map-route";

setWorkerUrl(maplibreWorkerUrl);


function el(className, html) {
  const div = document.createElement("div");
  div.className = className;
  if (html) div.innerHTML = html;
  return div;
}

const CAR_SVG =
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';

const PIN_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>';

const SQUARE_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

const savedViews = new Map();
const retainedMaps = new Map();
export default function MapView({
  viewCacheKey,
  center = { lat: 40.7128, lng: -74.006 },
  zoom = 13,
  pickup,
  dropoff,
  routeGeometry,
  drivers = [],
  driverPosition,
  userPosition,
  fit = false,
  fitTo,
  fitKey,
  compact = false,
  followPosition,
  navigationMode = false,
  onClick,
  className = "",
  style,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const markersRef = useRef({ pickup: null, dropoff: null, driver: null, user: null });
  const driverDotsRef = useRef(new Map());
  const animRef = useRef(null);
  const routeGeomRef = useRef(null);
  const navFixRef = useRef(null);
  const navRouteRef = useRef(null);
  navFixRef.current = userPosition;
  navRouteRef.current = routeGeometry;
  const lastUserMoveRef = useRef(0);
  const initialUserCenterRef = useRef(false);
  const onClickRef = useRef(onClick);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  // Initialisation de la carte
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const saved = viewCacheKey && savedViews.get(viewCacheKey);
    const retained = viewCacheKey && retainedMaps.get(viewCacheKey);
    if (retained) { clearTimeout(retained.timer); retainedMaps.delete(viewCacheKey); }
    const host = retained?.host || document.createElement("div");
    host.style.cssText = "width:100%;height:100%;";
    containerRef.current.appendChild(host);
    const map = retained?.map || new MLMap({
      container: host,
      style: "/map-dark.json",
      center: saved?.center || [center.lng, center.lat],
      zoom: saved?.zoom ?? zoom,
      pitch: 0,
      attributionControl: false,
      cooperativeGestures: false, // un seul doigt suffit pour parcourir la carte
    });

    // Credits are rendered in a separate footer outside the map canvas.

    const markUserMove = (e) => {
      if (e?.originalEvent) lastUserMoveRef.current = Date.now();
    };
    map.on("dragstart", markUserMove);
    map.on("zoomstart", markUserMove);


    const applyRoute = () => {
      readyRef.current = drawRoute(map, routeGeomRef.current);
    };

    map.on("load", applyRoute);
    map.on("style.load", applyRoute);
    map.on("idle", applyRoute);
    const click = (e) => onClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    map.on("click", click);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    requestAnimationFrame(() => map.resize());

    mapRef.current = map;

    return () => {
      if (viewCacheKey) savedViews.set(viewCacheKey, { center: map.getCenter().toArray(), zoom: map.getZoom() });
      ro.disconnect();
      cancelAnimationFrame(animRef.current);
      Object.values(markersRef.current).forEach(marker => marker?.remove());
      markersRef.current = { pickup: null, dropoff: null, driver: null, user: null };
      driverDotsRef.current.forEach(marker => marker.remove());
      driverDotsRef.current.clear();
      map.off("dragstart", markUserMove); map.off("zoomstart", markUserMove);
      map.off("load", applyRoute); map.off("style.load", applyRoute); map.off("idle", applyRoute); map.off("click", click);
      try {
        if (viewCacheKey) {
          host.remove();
          const timer = setTimeout(() => { retainedMaps.delete(viewCacheKey); map.remove(); }, 300000);
          retainedMaps.set(viewCacheKey, { map, host, timer });
        } else map.remove();
      } catch (err) {
        console.warn("[MapView] map.remove() failed:", err?.message);
      }
      if (mapRef.current === map) mapRef.current = null;
      readyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Synchronisation des marqueurs
  function syncMarker(key, pos, make) {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    if (!pos) {
      markers[key]?.remove();
      markers[key] = null;
      return;
    }
    if (!markers[key]) {
      markers[key] = new Marker({ element: make() }).setLngLat([pos.lng, pos.lat]).addTo(map);
    } else {
      markers[key].setLngLat([pos.lng, pos.lat]);
    }
  }

  useEffect(() => {
    syncMarker("pickup", pickup, () => el("marker-pin pickup", PIN_SVG));
  }, [pickup?.lat, pickup?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    syncMarker("dropoff", dropoff, () => el("marker-pin dropoff", SQUARE_SVG));
  }, [dropoff?.lat, dropoff?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position only: turn-by-turn guidance belongs to the selected external GPS app.
  useEffect(() => {
    if (navigationMode) { syncMarker("user", null); return; }
    syncMarker("user", userPosition, () => el("marker-dot-simple", ""));
  }, [userPosition?.lat, userPosition?.lng, navigationMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // The first GPS fix must be visible, including while the driver is offline.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPosition || initialUserCenterRef.current || fit || followPosition || navigationMode) return;
    initialUserCenterRef.current = true;
    if (lastUserMoveRef.current) return;
    map.easeTo({ center: [userPosition.lng, userPosition.lat], duration: 600 });
  }, [userPosition?.lat, userPosition?.lng, fit, Boolean(followPosition), navigationMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Véhicules à proximité
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const dots = driverDotsRef.current;
    const seen = new Set();

    for (const d of drivers) {
      if (!d?.location) continue;
      seen.add(d.id);
      const lngLat = [d.location.lng, d.location.lat];
      if (dots.has(d.id)) {
        dots.get(d.id).setLngLat(lngLat);
      } else {
        const m = new Marker({ element: el("marker-driver", CAR_SVG) }).setLngLat(lngLat).addTo(map);
        m.getElement().style.opacity = "0.85";
        dots.set(d.id, m);
      }
    }

    for (const [id, marker] of dots) {
      if (!seen.has(id)) {
        marker.remove();
        dots.delete(id);
      }
    }
  }, [drivers]);

  // Tracé d'itinéraire
  useEffect(() => {
    if (navigationMode) return;
    routeGeomRef.current = routeGeometry || null;
    const map = mapRef.current;
    if (!map) return;
    readyRef.current = drawRoute(map, routeGeomRef.current);
  }, [routeGeometry, navigationMode, userPosition?.lat, userPosition?.lng]);

  // Local animation: never send predicted positions to the server.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !navigationMode) return;
    const node = el("marker-pin navigation-cursor", '<svg viewBox="0 0 32 32" width="32" height="32"><path d="M16 3 27 28 16 22 5 28Z" fill="#d4af37" stroke="#17212d" stroke-width="2" stroke-linejoin="round"/></svg>');
    node.style.cssText = "width:34px;height:34px;background:transparent;border:0;box-shadow:none";
    const marker = new Marker({element:node, rotationAlignment:"map"});
    let frame, displayed, last = 0, lastDraw = 0, attached = false, bearing = 0;
    let previousRoute, previousIndex = 0;
    const tick = (time) => {
      frame = requestAnimationFrame(tick);
      const fix = navFixRef.current;
      if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return;
      const route = navRouteRef.current;
      if (route !== previousRoute) { previousRoute = route; previousIndex = 0; }
      const target = predictPosition(fix, Date.now());
      const dt = last ? Math.min(100,time-last) : 16;
      last = time;
      const alpha = 1-Math.exp(-dt/100);
      displayed = displayed ? {lat:displayed.lat+(target.lat-displayed.lat)*alpha,lng:displayed.lng+(target.lng-displayed.lng)*alpha} : target;
      const snap = projectRoute(route, displayed);
      const onRoute = snap && snap.distance <= Math.max(12, Math.min(25,fix.accuracy || 12)) && snap.index >= previousIndex;
      const p = onRoute ? snap : displayed;
      if (onRoute) previousIndex = snap.index;
      marker.setLngLat([p.lng,p.lat]);
      if (!attached) { marker.addTo(map); attached = true; }
      if (Number.isFinite(fix.heading) && fix.speed > 0.7) bearing += (((fix.heading-bearing+540)%360)-180)*alpha;
      marker.setRotation(bearing);
      if (time-lastDraw >= 65) {
        lastDraw = time;
        routeGeomRef.current = onRoute ? [[p.lng,p.lat], ...route.slice(snap.index+1)] : route;
        drawRoute(map,routeGeomRef.current);
      }
      if (Date.now()-lastUserMoveRef.current >= 8000) map.jumpTo({center:[p.lng,p.lat],bearing,zoom:Math.max(map.getZoom(),16),padding:fitPadding(map)});
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); marker.remove(); };
  }, [navigationMode]);

  // Cadrage d'itinéraire (hors navigation active)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fit || followPosition || navigationMode) return;

    const points = [];
    if (fitTo) {
      for (const p of fitTo) if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) points.push([p.lng, p.lat]);
    } else {
      if (pickup) points.push([pickup.lng, pickup.lat]);
      if (dropoff) points.push([dropoff.lng, dropoff.lat]);
      if (driverPosition) points.push([driverPosition.lng, driverPosition.lat]);
      if (routeGeometry?.length) points.push(...routeGeometry);
    }
    if (points.length < 2) {
      if (points.length === 1) map.easeTo({ center: points[0], zoom: 15, duration: 600 });
      return;
    }

    const bounds = points.reduce((b, p) => b.extend(p), new LngLatBounds(points[0], points[0]));
    map.fitBounds(bounds, { padding: compact ? 38 : fitPadding(map), duration: 700, maxZoom: 16 });
  }, [fit, pickup?.lat, dropoff?.lat, routeGeometry, fitKey, Boolean(followPosition), navigationMode, compact]); // eslint-disable-line react-hooks/exhaustive-deps

  // Suivi GPS temps réel 3D (type Waze)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !followPosition || navigationMode) return;
    // Si l'utilisateur touche la carte, pause de 8 secondes avant de reprendre le suivi
    if (Date.now() - lastUserMoveRef.current < 8000) return;

    map.easeTo({ center: [followPosition.lng, followPosition.lat],
      zoom: Math.max(map.getZoom(), 15.5), pitch: 0, bearing: 0,
      padding: fitPadding(map), duration: 800 });
  }, [followPosition?.lat, followPosition?.lng, followPosition?.heading, navigationMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`modern-map-frame ${className}`} style={{ width: "100%", height: "100%", ...style }}>
      <div ref={containerRef} className="modern-map" style={{ width: "100%", flex: 1, minHeight: 0 }} aria-label="Carte GPS" />
      {!compact && (
        <details className="map-source-footer">
          <summary>Sources</summary>
          <span>
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
          {" · "}<a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>
          {" · "}<a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>
          </span>
        </details>
      )}
    </div>
  );
}

function fitPadding(map) {
  const box = map.getContainer().getBoundingClientRect();
  const panel = document.querySelector(".ride-panel")?.getBoundingClientRect();
  const pad = { top: 60, bottom: 60, left: 50, right: 50 };
  if (!panel || panel.height === 0) return pad;
  if (box.width <= 900) pad.bottom = Math.min(box.height - 140, Math.max(60, box.bottom - panel.top + 24));
  else pad.left = Math.min(box.width - 200, Math.max(50, panel.right - box.left + 30));
  return pad;
}

