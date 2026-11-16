"use client";

import { useEffect, useRef, useState } from "react";
import { policeCapSvg, frenchRadarSvg } from "@/components/icons/road-alert-icons";
import useMapSpeedCameras from "@/hooks/useMapSpeedCameras";
import { mergeCameraAlerts } from "@/lib/vtc-speed-cameras";
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
  const previousRef = useRef(null);
  const headingRef = useRef(0);
  const followPreviousRef = useRef(null);
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
      map;
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
    if (userPosition) {
      let heading = userPosition.heading;
      if (!Number.isFinite(heading)) {
        const previous = previousRef.current;
        heading =
          previous &&
          Math.hypot(previous.lat - userPosition.lat, previous.lng - userPosition.lng) > 0.00005
            ? computeBearing(previous, userPosition)
            : headingRef.current;
      }
      headingRef.current = heading;
      previousRef.current = userPosition;
      const node = navigationMode ? make3DNavigationArrow() : el("marker-dot-simple", "");
      const arrow = node.querySelector(".waze-nav-arrow-body");
      if (arrow) arrow.style.transform = `rotate(${heading - (map.getHeading() || 0)}deg)`;
      add(userPosition, node);
    }
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
    const rotateArrow = () => {
      const arrow = containerRef.current?.querySelector(".waze-nav-arrow-body");
      if (arrow)
        arrow.style.transform = `rotate(${headingRef.current - (map.getHeading() || 0)}deg)`;
    };
    const headingListener = map.addListener("heading_changed", rotateArrow);
    rotateArrow();
    return () => {
      headingListener.remove();
      markers.forEach((marker) => marker.remove());
    };
  }, [
    ready,
    pickup,
    dropoff,
    driverPosition,
    drivers,
    userPosition,
    navigationMode,
    showRoadAlerts,
    alerts,
    cameras,
  ]);

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
    const lines = [
      { strokeColor: "#111923", strokeWeight: 13 },
      { strokeColor: "#e9b95c", strokeWeight: 8 },
      { strokeColor: "#ffe4a0", strokeWeight: 2 },
    ].map(
      (options) =>
        new mapsRef.current.Polyline({
          ...options,
          path,
          map: mapRef.current,
          clickable: false,
          geodesic: false,
          zIndex: 2,
        }),
    );
    return () => lines.forEach((line) => line.setMap(null));
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

  useEffect(() => {
    if (!ready || !followPosition || Date.now() - lastMoveRef.current < 8000) return;
    const map = mapRef.current;
    const previous = followPreviousRef.current;
    let heading = followPosition.heading;
    if (!Number.isFinite(heading)) {
      heading =
        previous &&
        Math.hypot(previous.lat - followPosition.lat, previous.lng - followPosition.lng) > 0.00005
          ? computeBearing(previous, followPosition)
          : headingRef.current;
    }
    followPreviousRef.current = followPosition;
    headingRef.current = heading;
    map.moveCamera({
      center: { lat: followPosition.lat, lng: followPosition.lng },
      zoom: navigationMode ? 18 : Math.max(map.getZoom(), 15.5),
      tilt: navigationMode && !flatOnly ? 60 : 0,
      heading: navigationMode && !flatOnly ? heading : 0,
    });
  }, [
    ready,
    followPosition?.lat,
    followPosition?.lng,
    followPosition?.heading,
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
