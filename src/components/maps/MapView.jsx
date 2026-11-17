'use client';
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/google-maps-loader';
const CAR = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 10 2-5h14l2 5v8h-3v-2H6v2H3zM3 10h18"/><circle cx="7" cy="13" r="1"/><circle cx="17" cy="13" r="1"/></svg>';
const DOT = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>';
const SQUARE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
const DARK_STYLE = [
 { elementType: 'geometry', stylers: [{ color: '#18222c' }] },
 { elementType: 'labels.text.stroke', stylers: [{ color: '#18222c' }] },
 { elementType: 'labels.text.fill', stylers: [{ color: '#a9b8c8' }] },
 { featureType: 'poi', stylers: [{ visibility: 'off' }] },
 { featureType: 'transit', stylers: [{ visibility: 'off' }] },
 { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#344352' }] },
 { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4b5b6c' }] },
 { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1a26' }] },
 { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#1e2d2a' }] },
];
const valid = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
function makeMarker(maps, map, position, className, html = '') {
  class Marker extends maps.OverlayView {
    constructor() { super(); this.position = position; this.element = document.createElement('div'); this.element.style.cssText = 'position:absolute;transform:translate(-50%,-50%);pointer-events:none'; this.element.innerHTML = `<div class="${className}">${html}</div>`; this.setMap(map); }
    onAdd() { this.getPanes().overlayMouseTarget.appendChild(this.element); }
    draw() { const pixel = this.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(this.position)); if (pixel) { this.element.style.left = `${pixel.x}px`; this.element.style.top = `${pixel.y}px`; } }
    setPosition(pos) { this.position = pos; this.draw(); }
    onRemove() { this.element.remove(); }
    remove() { this.setMap(null); }
  }
  return new Marker();
}
function mapPadding(container, compact) {
  if (compact) return 30;
  const box = container.getBoundingClientRect();
  const padding = { top: 60, bottom: 55, left: 30, right: 30 };
  const panels = ['.ride-panel', '.drv-ride-dock', '.drv-top-passenger-bar'].map(selector => document.querySelector(selector)?.getBoundingClientRect()).filter(p => p?.height);
  for (const panel of panels) {
    if (panel.right <= box.left || panel.left >= box.right) continue;
    if (box.width > 900 && panel.left < box.left + box.width / 2) padding.left = Math.min(box.width - 160, Math.max(padding.left, panel.right - box.left + 24));
    else if (panel.top >= box.top + box.height / 2) padding.bottom = Math.min(box.height / 2, Math.max(padding.bottom, box.bottom - panel.top + 24));
    else if (panel.bottom <= box.top + box.height / 2) padding.top = Math.min(box.height / 2, Math.max(padding.top, panel.bottom - box.top + 24));
  }
  return padding;
}
export default function MapView({ center = {lat:48.5734,lng:7.7521}, zoom = 13, pickup, dropoff, routeGeometry, drivers = [], driverPosition, userPosition, fit = false, fitTo, fitKey, compact = false, followPosition, onClick, className = '', style }) {
  const frame = useRef(null), container = useRef(null), map = useRef(null), maps = useRef(null), markers = useRef(new Map()), routes = useRef([]), lastTouch = useRef(0), initialCenter = useRef(false), latest = useRef({});
  latest.current = {center,zoom,onClick};
  const [ready,setReady] = useState(false), [error,setError] = useState(''), [attempt,setAttempt] = useState(0), [bottomInset,setBottomInset] = useState(0);
  // Keep Google's built-in logo/terms inside the uncovered map rectangle.
  useEffect(() => {
    const update = () => {
      if (!frame.current) return;
      const box = frame.current.getBoundingClientRect();
      let bottom = box.bottom;
      const overlays = [...document.querySelectorAll('.sidebar, .drv-ride-dock, .ride-panel')].map(el => el.getBoundingClientRect());
      for (let pass = 0; pass < 3; pass++) for (const overlay of overlays) {
        if (overlay.height && overlay.right > box.left && overlay.left < box.right && overlay.top > box.top + 60 && overlay.top < bottom && overlay.bottom >= bottom - 4) bottom = overlay.top - 4;
      }
      setBottomInset(Math.max(0, Math.round(box.bottom - bottom)));
    };
    update();
    const observer = new ResizeObserver(update); if (frame.current) observer.observe(frame.current);
    document.querySelectorAll('.sidebar, .drv-ride-dock, .ride-panel').forEach(el => observer.observe(el));
    window.addEventListener('resize',update);
    return () => { observer.disconnect(); window.removeEventListener('resize',update); };
  }, [ready,compact]);
  useEffect(() => {
    let stopped = false, observer, listeners = [];
    setError(''); setReady(false);
    loadGoogleMaps().then(api => {
      if (stopped || !container.current) return;
      maps.current = api;
      const instance = new api.Map(container.current, { center: latest.current.center, zoom: latest.current.zoom, styles: DARK_STYLE, mapTypeId:'roadmap', disableDefaultUI:true, zoomControl:!compact, gestureHandling:'greedy', clickableIcons:false, tilt:0, heading:0 });
      map.current = instance;
      listeners = [instance.addListener('click', e => { if (e.latLng) latest.current.onClick?.({lat:e.latLng.lat(),lng:e.latLng.lng()}); }), instance.addListener('dragstart', () => { lastTouch.current = Date.now(); })];
      observer = new ResizeObserver(() => api.event.trigger(instance, 'resize')); observer.observe(container.current);
      setReady(true);
    }).catch(err => { if (!stopped) setError(err.message); });
    const authError = () => { if (!stopped) setError('Google Maps est indisponible. Vérifiez l’activation et les restrictions de la clé navigateur.'); };
    const oldAuthFailure = window.gm_authFailure;
    window.gm_authFailure = authError;
    return () => { stopped = true; observer?.disconnect(); listeners.forEach(l => l.remove()); markers.current.forEach(marker => marker.remove()); markers.current.clear(); routes.current.forEach(line => line.setMap(null)); routes.current = []; if (map.current) maps.current?.event.clearInstanceListeners(map.current); map.current = null; if (window.gm_authFailure === authError) window.gm_authFailure = oldAuthFailure; };
  }, [attempt]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const wanted = new Map();
    if (valid(pickup)) wanted.set('pickup', [pickup,'marker-pin pickup',DOT]);
    if (valid(dropoff)) wanted.set('dropoff', [dropoff,'marker-pin dropoff',SQUARE]);
    if (valid(userPosition)) wanted.set('user', [userPosition,'marker-dot-simple','']);
    if (valid(driverPosition)) wanted.set('driver', [driverPosition,'marker-driver',CAR]);
    for (const driver of drivers) if (valid(driver.location)) wanted.set(`nearby:${driver.id}`, [driver.location,'marker-driver',CAR]);
    wanted.forEach(([pos,cls,html],key) => { if (markers.current.has(key)) markers.current.get(key).setPosition(pos); else markers.current.set(key, makeMarker(maps.current,map.current,pos,cls,html)); });
    markers.current.forEach((marker,key) => { if (!wanted.has(key)) { marker.remove(); markers.current.delete(key); } });
  }, [ready,pickup?.lat,pickup?.lng,dropoff?.lat,dropoff?.lng,userPosition?.lat,userPosition?.lng,driverPosition?.lat,driverPosition?.lng,drivers]);
  useEffect(() => {
    if (!ready || !map.current) return;
    routes.current.forEach(line => line.setMap(null)); routes.current = [];
    const path = (routeGeometry || []).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map(([lng,lat]) => ({lat,lng}));
    if (path.length < 2) return;
    routes.current = [{color:'#111923',weight:10},{color:'#e9b95c',weight:7},{color:'#ffe4a0',weight:2}].map((line,i) => new maps.current.Polyline({map:map.current,path,strokeColor:line.color,strokeWeight:line.weight,strokeOpacity:1,zIndex:i+1,clickable:false}));
  }, [ready,routeGeometry]);
  useEffect(() => {
    if (!ready || !map.current || !fit || followPosition) return;
    const points = fitTo ? fitTo.filter(valid) : [pickup,dropoff,driverPosition,...(routeGeometry || []).map(([lng,lat]) => ({lat,lng}))].filter(valid);
    if (!points.length) return;
    if (points.length === 1) { map.current.panTo(points[0]); map.current.setZoom(15); return; }
    const bounds = new maps.current.LatLngBounds(); points.forEach(p => bounds.extend(p));
    map.current.fitBounds(bounds,mapPadding(container.current,compact));
    const listener = maps.current.event.addListenerOnce(map.current,'idle',()=>{ if (map.current?.getZoom() > 16) map.current.setZoom(16); });
    return () => listener.remove();
  }, [ready,fit,fitKey,fitTo,pickup?.lat,pickup?.lng,dropoff?.lat,dropoff?.lng,routeGeometry,Boolean(followPosition),compact]);
  useEffect(() => {
    if (!ready || !map.current) return;
    if (valid(followPosition)) {
      if (Date.now() - lastTouch.current < 8000) return;
      map.current.panTo(followPosition); if (map.current.getZoom() < 15.5) map.current.setZoom(15.5);
    } else if (valid(userPosition) && !initialCenter.current && !fit) {
      initialCenter.current = true; if (!lastTouch.current) map.current.panTo(userPosition);
    }
  }, [ready,followPosition?.lat,followPosition?.lng,userPosition?.lat,userPosition?.lng,fit]);
  return <div ref={frame} className={`modern-map-frame google-map-frame ${className}`} style={{width:'100%',height:'100%',position:'relative',...style}}>
    <div ref={container} className="modern-map google-map-canvas" aria-label="Carte Google Maps" style={{width:'100%',position:'absolute',top:0,left:0,right:0,bottom:bottomInset,minHeight:0}} />
    {!ready && !error && <div className="google-map-status" role="status">Chargement de la carte…</div>}
    {error && <div className="google-map-status" role="alert"><p>{error}</p><button className="btn btn-secondary btn-sm" onClick={()=>setAttempt(value=>value+1)}>Réessayer</button></div>}
  </div>;
}
