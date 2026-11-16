"use client";

import { useEffect, useRef, useState } from "react";
import { policeCapSvg, frenchRadarSvg } from "@/components/icons/road-alert-icons";
import useMapSpeedCameras from "@/hooks/useMapSpeedCameras";
import { mergeCameraAlerts } from "@/lib/vtc-speed-cameras";
import { interpolateFix } from "@/lib/map-motion";
import { remainingRoute } from "@/lib/utils/route-display";
import { loadGoogleMaps, createHtmlMarker, cameraViewport } from "@/lib/google-maps-browser";

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

// Navigation marker: a simple blue direction arrow, with no legacy gold styling.
function makeNavigationArrow() {
  return el(
    "google-navigation-marker",
    `<svg class="google-navigation-arrow" width="46" height="46" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5L41 41L24 33L7 41Z" fill="#1a73e8" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>`,
  );
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
  center = { lat: 48.5734, lng: 7.7521 },
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
  showRoadAlerts = false,
  followPosition,
  navigationMode = false,
  alerts = [],
  onClick,
  className = "",
  style,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const mapsRef = useRef(null);
  const onClickRef = useRef(onClick);
  const initialRef = useRef({ center, zoom });
  const lastMoveRef = useRef(0);
  const motionRef = useRef(null);
  const animationRef = useRef(null);
  const userMarkerRef = useRef(null);
  const userNodeRef = useRef(null);
  const routeLinesRef = useRef([]);
  const headingRef = useRef(0);
  const progressRef = useRef({ original: null, progress: 0 });
  const centeredRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [flatOnly, setFlatOnly] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  onClickRef.current = onClick;

  useEffect(() => {
    let stopped = false,
      resize,
      map,
      trafficLayer;
    setError("");
    setReady(false);
    loadGoogleMaps()
      .then((maps) => {
        if (stopped) return;
        mapsRef.current = maps;
        map = new maps.Map(containerRef.current, {
          center: initialRef.current.center,
          zoom: initialRef.current.zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          clickableIcons: false,
          // Explicit vector rendering enables tilt/heading on road maps, including mobile.
          renderingType: maps.RenderingType.VECTOR,
          colorScheme: maps.ColorScheme.DARK,
          tiltInteractionEnabled: true,
          headingInteractionEnabled: true,
          // Google attribution stays visible in every map.
        });
        trafficLayer = new maps.TrafficLayer({ autoRefresh: true });
        trafficLayer.setMap(map);
        mapRef.current = map;
        const checkRendering = () => {
          const type = map.getRenderingType();
          setFlatOnly(type === maps.RenderingType.RASTER);
        };
        checkRendering();
        map.addListener("renderingtype_changed", checkRendering);
        cameraRef.current = cameraViewport(map, maps);
        map.addListener("click", (event) => {
          if (event.latLng) onClickRef.current?.(event.latLng.toJSON());
        });
        map.addListener("dragstart", () => {
          lastMoveRef.current = Date.now();
        });
        // Wheel/touch zoom also pauses automatic following, without counting programmatic movement.
        const moved = () => {
          lastMoveRef.current = Date.now();
        };
        containerRef.current.addEventListener("wheel", moved, { passive: true });
        containerRef.current.addEventListener("touchstart", moved, { passive: true });
        const container = containerRef.current;
        resize = new ResizeObserver(() => maps.event.trigger(map, "resize"));
        resize.observe(container);
        map.__cleanupInput = () => {
          container.removeEventListener("wheel", moved);
          container.removeEventListener("touchstart", moved);
        };
        setReady(true);
      })
      .catch((err) => {
        if (!stopped) setError(err.message);
      });
    return () => {
      stopped = true;
      resize?.disconnect();
      trafficLayer?.setMap(null);
      if (map) {
        map.__cleanupInput?.();
        mapsRef.current.event.clearInstanceListeners(map);
      }
      mapRef.current = null;
      cameraRef.current = null;
    };
  }, [attempt]);

  const cameras = useMapSpeedCameras(cameraRef, ready && showRoadAlerts && !compact);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current,
      maps = mapsRef.current,
      markers = [];
    const add = (position, node) => {
      if (!Number.isFinite(position?.lat) || !Number.isFinite(position?.lng)) return;
      markers.push(createHtmlMarker(maps, map, { lat: position.lat, lng: position.lng }, node));
    };
    add(pickup, el("marker-pin pickup", PIN_SVG));
    add(dropoff, el("marker-pin dropoff", SQUARE_SVG));
    add(driverPosition, el("marker-driver", CAR_SVG));
    for (const driver of drivers) add(driver.location, el("marker-driver", CAR_SVG));
    if (showRoadAlerts)
      for (const alert of mergeCameraAlerts(alerts, cameras)) {
        const node = el(
          `marker-road-alert is-${alert.kind}${alert.permanent ? " is-permanent" : ""}`,
          alert.kind === "police" ? POLICE_SVG : RADAR_SVG,
        );
        node.title =
          alert.source === "osm"
            ? "Radar OpenStreetMap"
            : alert.source === "official-fr"
              ? "Radar · Sécurité routière"
              : alert.kind === "police"
                ? "Contrôle de police signalé"
                : "Radar fixe";
        if (alert.maxspeed) node.title += ` · ${alert.maxspeed} km/h`;
        add(alert, node);
      }
    return () => markers.forEach((marker) => marker.remove());
  }, [ready, pickup, dropoff, driverPosition, drivers, showRoadAlerts, alerts, cameras]);

  useEffect(() => {
    if (!ready) return;
    routeLinesRef.current = [
      { strokeColor: "#1557b0", strokeWeight: 8, strokeOpacity: 0.9, zIndex: 1 },
      { strokeColor: "#1a73e8", strokeWeight: 5, strokeOpacity: 1, zIndex: 2 },
    ].map(
      (options) =>
        new mapsRef.current.Polyline({
          ...options,
          path: [],
          map: mapRef.current,
          clickable: false,
          geodesic: false,
        }),
    );
    return () => {
      routeLinesRef.current.forEach((line) => line.setMap(null));
      routeLinesRef.current = [];
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const tracking = progressRef.current;
    if (tracking.original !== routeGeometry) {
      tracking.original = routeGeometry;
      tracking.progress = 0;
    }
    const remaining = navigationMode
      ? remainingRoute(routeGeometry, userPosition, tracking.progress)
      : { geometry: routeGeometry, progress: 0 };
    tracking.progress = remaining.progress;
    const path = (remaining.geometry || []).map(([lng, lat]) => ({ lat, lng }));
    routeLinesRef.current.forEach((line) => line.setPath(path));
  }, [ready, routeGeometry, navigationMode, userPosition?.lat, userPosition?.lng]);

  useEffect(() => {
    if (!ready || !fit || followPosition || navigationMode) return;
    const points = fitTo || [
      pickup,
      dropoff,
      driverPosition,
      ...(routeGeometry || []).map(([lng, lat]) => ({ lat, lng })),
    ];
    const valid = points.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
    if (!valid.length) return;
    const map = mapRef.current;
    if (valid.length === 1) {
      map.setCenter(valid[0]);
      map.setZoom(15);
      return;
    }
    const bounds = new mapsRef.current.LatLngBounds();
    valid.forEach((point) => bounds.extend({ lat: point.lat, lng: point.lng }));
    map.fitBounds(bounds, compact ? 38 : fitPadding(map));
    const listener = mapsRef.current.event.addListenerOnce(map, "idle", () => {
      if (map.getZoom() > 16) map.setZoom(16);
    });
    return () => listener.remove();
  }, [
    ready,
    fit,
    fitTo,
    pickup?.lat,
    pickup?.lng,
    dropoff?.lat,
    dropoff?.lng,
    driverPosition?.lat,
    driverPosition?.lng,
    routeGeometry,
    fitKey,
    Boolean(followPosition),
    navigationMode,
    compact,
  ]);

  useEffect(() => {
    if (!ready || !userPosition || centeredRef.current || fit || followPosition || navigationMode)
      return;
    centeredRef.current = true;
    if (!lastMoveRef.current)
      mapRef.current.panTo({ lat: userPosition.lat, lng: userPosition.lng });
  }, [ready, userPosition?.lat, userPosition?.lng, fit, Boolean(followPosition), navigationMode]);

  // Keep the user's marker mounted; GPS fixes update its position instead of rebuilding it.
  useEffect(() => {
    if (!ready || !userPosition) return;
    const node = navigationMode ? makeNavigationArrow() : el("marker-dot-simple", "");
    userNodeRef.current = node;
    userMarkerRef.current = createHtmlMarker(
      mapsRef.current,
      mapRef.current,
      motionRef.current || { lat: userPosition.lat, lng: userPosition.lng },
      node,
    );
    const rotate = () => {
      const arrow = node.querySelector(".google-navigation-arrow");
      if (arrow)
        arrow.style.transform = `rotate(${headingRef.current - (mapRef.current.getHeading() || 0)}deg)`;
    };
    const listener = mapRef.current.addListener("heading_changed", rotate);
    rotate();
    return () => {
      listener.remove();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      userNodeRef.current = null;
    };
  }, [ready, navigationMode, Boolean(userPosition)]);

  // Camera and cursor share the same interpolated position on each animation frame.
  useEffect(() => {
    cancelAnimationFrame(animationRef.current);
    if (!ready) return;
    const position = followPosition || userPosition;
    if (!Number.isFinite(position?.lat) || !Number.isFinite(position?.lng)) return;
    const from = motionRef.current;
    let heading = position.heading;
    if (!Number.isFinite(heading)) {
      heading =
        from && Math.hypot(from.lat - position.lat, from.lng - position.lng) > 0.00005
          ? computeBearing(from, position)
          : headingRef.current;
    }
    const target = { lat: position.lat, lng: position.lng, heading };
    const distance = from ? Math.hypot(from.lat - target.lat, from.lng - target.lng) : Infinity;
    // First fix or GPS relocation: no animation across an implausibly long distance.
    const duration = !from || distance > 0.003 ? 0 : 850;
    const start = performance.now();
    const frame = (now) => {
      const progress = duration ? Math.min(1, (now - start) / duration) : 1;
      const fix = from ? interpolateFix(from, target, progress) : target;
      motionRef.current = fix;
      headingRef.current = fix.heading;
      userMarkerRef.current?.setPosition({ lat: fix.lat, lng: fix.lng });
      const map = mapRef.current;
      if (!map) return;
      if (followPosition && Date.now() - lastMoveRef.current >= 8000) {
        map.moveCamera({
          center: { lat: fix.lat, lng: fix.lng },
          zoom: navigationMode ? 18 : Math.max(map.getZoom(), 15.5),
          tilt: navigationMode && !flatOnly ? 60 : 0,
          heading: navigationMode && !flatOnly ? fix.heading : 0,
        });
      }
      const arrow = userNodeRef.current?.querySelector(".google-navigation-arrow");
      if (arrow) arrow.style.transform = `rotate(${fix.heading - (map.getHeading() || 0)}deg)`;
      if (progress < 1) animationRef.current = requestAnimationFrame(frame);
    };
    frame(start);
    return () => cancelAnimationFrame(animationRef.current);
  }, [
    ready,
    followPosition?.lat,
    followPosition?.lng,
    followPosition?.heading,
    userPosition?.lat,
    userPosition?.lng,
    userPosition?.heading,
    navigationMode,
    flatOnly,
  ]);

  return (
    <div
      className={`modern-map-frame google-map-frame ${className}`}
      style={{ width: "100%", height: "100%", ...style }}
    >
      <div
        ref={containerRef}
        className="modern-map google-map"
        style={{ width: "100%", flex: 1, minHeight: 0 }}
        aria-label="Carte Google Maps"
      />
      {!ready && (
        <div role={error ? "alert" : "status"} className="google-map-status">
          {error || "Chargement de Google Maps…"}
          {error && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Réessayer
            </button>
          )}
        </div>
      )}
      {ready && navigationMode && flatOnly && (
        <div role="status" className="google-map-flat-notice">
          Vue 3D indisponible sur cet appareil. Le suivi GPS reste actif en 2D.
        </div>
      )}
      {showRoadAlerts && !compact && (
        <div className="map-source-footer">
          <span>
            Radars : Sécurité routière ·{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              © OpenStreetMap
            </a>{" "}
            · Signalements des chauffeurs
          </span>
        </div>
      )}
    </div>
  );
}

function fitPadding(map) {
  const box = map.getDiv().getBoundingClientRect();
  const panel = document.querySelector(".ride-panel")?.getBoundingClientRect();
  const pad = { top: 60, bottom: 60, left: 50, right: 50 };
  if (!panel || panel.height === 0) return pad;
  if (box.width <= 900)
    pad.bottom = Math.max(0, Math.min(box.height - 140, Math.max(60, box.bottom - panel.top + 24)));
  else pad.left = Math.max(0, Math.min(box.width - 200, Math.max(50, panel.right - box.left + 30)));
  return pad;
}
