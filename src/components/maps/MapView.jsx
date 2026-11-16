"use client";

import { useEffect, useRef } from "react";
import { Map as MLMap, Marker, LngLatBounds, AttributionControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { policeCapSvg, frenchRadarSvg } from "@/components/icons/road-alert-icons";

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

const POLICE_SVG = policeCapSvg(20);

const RADAR_SVG = frenchRadarSvg(20);

// Flèche 3D profilée style Waze en or métallique avec ombre portée
function make3DNavigationArrow() {
  const container = document.createElement("div");
  container.className = "waze-nav-arrow-container";
  container.innerHTML = `
    <div class="waze-nav-pulse"></div>
    <div class="waze-nav-arrow-shadow"></div>
    <div class="waze-nav-arrow-body">
      <svg width="44" height="48" viewBox="0 0 44 48" fill="none">
        <defs>
          <linearGradient id="wazeGradGold" x1="22" y1="2" x2="22" y2="44" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FEF08A"/>
            <stop offset="0.4" stop-color="#EAB308"/>
            <stop offset="1" stop-color="#854D0E"/>
          </linearGradient>
          <filter id="wazeDepth" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.6"/>
          </filter>
        </defs>
        <!-- Socle 3D profond -->
        <path d="M22 4L40 42L22 34L4 42L22 4Z" fill="#3B2506" />
        <!-- Corps de la flèche -->
        <path d="M22 2L39 39L22 32L5 39L22 2Z" fill="url(#wazeGradGold)" stroke="#FEF9C3" stroke-width="1.8" stroke-linejoin="round" filter="url(#wazeDepth)"/>
        <!-- Biseau lumière 3D gauche -->
        <path d="M22 2L5 39L22 32Z" fill="rgba(255, 255, 255, 0.28)"/>
        <!-- Cœur luminescent -->
        <circle cx="22" cy="24" r="3" fill="#FFFFFF"/>
      </svg>
    </div>
  `;
  return container;
}

// Calcul de l'angle entre deux coordonnées quand le téléphone ne donne pas de boussole
function computeBearing(p1, p2) {
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export default function MapView({
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
  alerts = [],
  onClick,
  className = "",
  style,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const markersRef = useRef({ pickup: null, dropoff: null, driver: null, user: null });
  const driverDotsRef = useRef(new Map());
  const alertDotsRef = useRef(new Map());
  const animRef = useRef(null);
  const routeGeomRef = useRef(null);
  const lastUserMoveRef = useRef(0);
  const prevPositionRef = useRef(null);
  const headingRef = useRef(0);
  const onClickRef = useRef(onClick);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  // Initialisation de la carte
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new MLMap({
      container: containerRef.current,
      style: "/map-dark.json",
      center: [center.lng, center.lat],
      zoom,
      pitch: navigationMode ? 58 : 0,
      attributionControl: false,
      cooperativeGestures: false, // un seul doigt suffit pour parcourir la carte
    });

    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    const markUserMove = (e) => {
      if (e?.originalEvent) lastUserMoveRef.current = Date.now();
    };
    map.on("dragstart", markUserMove);
    map.on("zoomstart", markUserMove);


    const applyRoute = () => {
      readyRef.current = drawRoute(map, routeGeomRef.current);
    };

    map.on("load", applyRoute);
    map.on("styledata", applyRoute);
    map.on("click", (e) => onClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    requestAnimationFrame(() => map.resize());

    mapRef.current = map;

    return () => {
      ro.disconnect();
      cancelAnimationFrame(animRef.current);
      markersRef.current = { pickup: null, dropoff: null, driver: null, user: null };
      driverDotsRef.current.clear();
      alertDotsRef.current.clear();
      try {
        map.remove();
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

  // Flèche de navigation temps réel
  useEffect(() => {
    const pos = userPosition;
    if (!pos) {
      syncMarker("user", null);
      return;
    }

    // Calcul du cap (direction de marche)
    let angle = pos.heading;
    if (angle == null || Number.isNaN(angle)) {
      if (prevPositionRef.current) {
        const dLat = Math.abs(pos.lat - prevPositionRef.current.lat);
        const dLng = Math.abs(pos.lng - prevPositionRef.current.lng);
        if (dLat > 0.00005 || dLng > 0.00005) {
          angle = computeBearing(prevPositionRef.current, pos);
          headingRef.current = angle;
        } else {
          angle = headingRef.current;
        }
      } else {
        angle = headingRef.current;
      }
    } else {
      headingRef.current = angle;
    }
    prevPositionRef.current = pos;

    syncMarker("user", pos, () => (navigationMode ? make3DNavigationArrow() : el("marker-dot-simple", "")));

    // Orientation de la flèche
    const userMarker = markersRef.current.user;
    if (userMarker && navigationMode) {
      const arrowBody = userMarker.getElement().querySelector(".waze-nav-arrow-body");
      if (arrowBody) {
        // En vue orientée, la flèche pointe vers le haut (0deg) ; sinon elle s'oriente selon l'angle
        arrowBody.style.transform = `rotate(${angle}deg)`;
      }
    }
  }, [userPosition?.lat, userPosition?.lng, userPosition?.heading, navigationMode]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Signalements police / radar
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const dots = alertDotsRef.current;
    const seen = new Set();
    for (const a of alerts || []) {
      if (!Number.isFinite(a?.lat) || !Number.isFinite(a?.lng)) continue;
      const key = `${a.id}:${a.kind}:${a.permanent ? 1 : 0}`;
      seen.add(key);
      if (dots.has(key)) {
        dots.get(key).setLngLat([a.lng, a.lat]);
        continue;
      }
      const node = el(
        `marker-road-alert is-${a.kind}${a.permanent ? " is-permanent" : ""}`,
        a.kind === "police" ? POLICE_SVG : RADAR_SVG,
      );
      node.title = a.kind === "police" ? "Contrôle de police signalé" : "Radar fixe";
      dots.set(key, new Marker({ element: node }).setLngLat([a.lng, a.lat]).addTo(map));
    }
    for (const [key, marker] of dots) {
      if (!seen.has(key)) {
        marker.remove();
        dots.delete(key);
      }
    }
  }, [alerts]);

  // Tracé d'itinéraire
  useEffect(() => {
    routeGeomRef.current = routeGeometry || null;
    const map = mapRef.current;
    if (!map) return;
    readyRef.current = drawRoute(map, routeGeometry);
  }, [routeGeometry]);

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
    if (!map || !followPosition) return;
    // Si l'utilisateur touche la carte, pause de 8 secondes avant de reprendre le suivi
    if (Date.now() - lastUserMoveRef.current < 8000) return;

    if (navigationMode) {
      map.easeTo({
        center: [followPosition.lng, followPosition.lat],
        zoom: 16.8,
        pitch: 58, // Perspective fuyante 3D Waze
        bearing: headingRef.current || 0, // La carte s'oriente dans le sens de la route
        padding: { top: 80, bottom: 220, left: 30, right: 30 }, // Véhicule placé dans le tiers bas
        duration: 900,
      });
    } else {
      map.easeTo({
        center: [followPosition.lng, followPosition.lat],
        zoom: Math.max(map.getZoom(), 15.5),
        pitch: 0,
        bearing: 0,
        padding: fitPadding(map),
        duration: 800,
      });
    }
  }, [followPosition?.lat, followPosition?.lng, followPosition?.heading, navigationMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className={`modern-map ${className}`}
      style={{ width: "100%", height: "100%", ...style }}
      aria-label="Carte GPS"
    />
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

function drawRoute(map, geometry) {
  const data = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: geometry || [] },
  };

  try {
    const existing = map.getSource("route");
    if (existing) {
      existing.setData(data);
      return true;
    }
  } catch {}

  let styleReady = false;
  try {
    styleReady = map.isStyleLoaded();
  } catch {
    styleReady = false;
  }
  if (!styleReady) return false;

  try {
    map.addSource("route", { type: "geojson", data });
    // Route colors are rendered directly; no canvas inversion.
    const layers = [
      { id: "route-halo", paint: { "line-color": "#f4c96b", "line-width": 20, "line-opacity": 0.35, "line-blur": 6 } },
      { id: "route-casing", paint: { "line-color": "#111923", "line-width": 13, "line-opacity": 1 } },
      { id: "route-line", paint: { "line-color": "#e9b95c", "line-width": 7 } },
      { id: "route-core", paint: { "line-color": "#ffe4a0", "line-width": 2 } },
    ];
    for (const l of layers) {
      if (map.getLayer(l.id)) continue;
      map.addLayer({
        id: l.id,
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: l.paint,
      });
    }
    return true;
  } catch {
    return false;
  }
}
