"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/archive-fetch";
import Link from "@/lib/archive-navigation";
import { ShieldCheck, SlidersHorizontal, Maximize2, Search, Home, LocateFixed, ArrowRight, ChevronRight, BarChart3, Wallet, PawPrint, Power, Car, List, FileText, ChevronDown, Route, Hand } from "lucide-react";
import MapView from "@/components/ArchiveMap";
import PlaceSearch from "@/components/maps/PlaceSearch";
import Modal from "@/components/ui/Modal";
import { money } from "@/components/ui/bits";
import useGeolocation from "@/hooks/useGeolocation";

export default function DriverHome({ loading, online, busy, isConnected, needsVehicle, position, center, onToggle, acceptsPet, togglingPet, onTogglePet, onWaybill }) {
  const [expanded, setExpanded] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const [today, setToday] = useState(null);
  const [balance, setBalance] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchedPoint, setSearchedPoint] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsPanelRef = useRef(null);
  const { position: localPosition } = useGeolocation({ watch: false });
  const mapCenter = searchedPoint || position || localPosition || center;
  useEffect(() => { if (online) setExpanded(true); }, [online]);
  useEffect(() => {
    if (!expanded) return;
    const escape = (e) => { if (e.key === 'Escape') { if (toolsOpen) setToolsOpen(false); else setExpanded(false); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [expanded, toolsOpen]);
  useEffect(() => {
    let alive = true;
    apiFetch('/api/drivers/me/earnings').then((r) => r.ok ? r.json() : null).then((d) => {
      if (!alive || !d) return;
      setToday(d.today || null); setBalance(d.wallet?.balance ?? null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [online]);
  useEffect(() => {
    if (!toolsOpen) return;
    const previous = document.activeElement;
    const panel = toolsPanelRef.current;
    panel?.querySelector('button')?.focus();
    const trapFocus = (event) => {
      if (event.key !== 'Tab') return;
      const items = panel?.querySelectorAll('button:not(:disabled), a[href]');
      const first = items?.[0], last = items?.[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel?.addEventListener('keydown', trapFocus);
    return () => { panel?.removeEventListener('keydown', trapFocus); previous?.focus(); };
  }, [toolsOpen]);
  const title = needsVehicle ? 'Vous y êtes presque' : online ? 'Vous êtes en ligne' : 'Vous êtes hors ligne';
  const status = loading ? 'Chargement…' : online ? isConnected ? 'Recherche de courses' : 'Reconnexion…' : 'Vous êtes hors ligne';
  const recenter = () => { setSearchedPoint(null); setRecenterKey((k) => k + 1); };
  return <div className={`drv-home driver-reference ${expanded ? 'driver-map-mode' : ''} ${online ? 'driver-is-online' : ''}`}>
    <div className="drv-home-inner">
      <div className="drv-top">
        <Link href="/driver/profile" className="drv-round" aria-label="Sécurité et documents"><ShieldCheck size={27} className="driver-shield" /></Link>
        <Link href="/driver/preferences" className="drv-round" aria-label="Préférences de conduite"><SlidersHorizontal size={27} /></Link>
      </div>
      <h1 className="drv-title">{loading ? '…' : title}</h1>
      <p className="drv-sub">{needsVehicle ? 'Ajoutez votre véhicule pour commencer' : online ? status : 'Prêt à partir ?'}</p>
      <div className={`drv-map driver-dark-map ${expanded ? 'expanded' : ''}`}>
        <MapView key={`${recenterKey}-${expanded}`} center={mapCenter} zoom={12.5} userPosition={position || localPosition || undefined} />
        {!expanded && <button className="driver-map-open" onClick={() => setExpanded(true)} aria-label="Ouvrir la carte" />}
        <button className="drv-map-btn left" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Retour à l’accueil' : 'Agrandir la carte'}>{expanded ? <Home size={25} /> : <Maximize2 size={25} />}</button>
        <button className="drv-map-btn right" onClick={() => setSearchOpen(true)} aria-label="Rechercher une adresse sur la carte"><Search size={26} /></button>
        {expanded && <>
          <Link href="/driver/earnings" className="driver-earnings-pill"><span>{today ? money(today.earnings) : '—'}</span><ChevronDown size={18} /></Link>
          <div className="driver-map-tools-left"><Link href="/driver/profile" className="drv-map-tool" aria-label="Sécurité et documents"><ShieldCheck className="driver-shield" size={28} /></Link></div>
          <div className="driver-map-tools-right"><button className="drv-map-tool" onClick={recenter} aria-label="Recentrer la carte"><LocateFixed size={25} /></button><Link href="/driver/discover" className="drv-map-tool driver-opportunities-icon" aria-label="Préférences de courses"><Route size={27} /></Link><Link href="/driver/earnings" className="drv-map-tool" aria-label="Voir les revenus"><BarChart3 size={27} /></Link></div>
          {!online && <button className="driver-go" disabled={busy || loading || needsVehicle} onClick={onToggle} aria-label="Passer en ligne">{busy ? <span className="spinner" /> : 'GO'}</button>}
        </>}
      </div>
      <div className="driver-home-sections">
        <div className="drv-section-head"><h2>Opportunités</h2><Link href="/driver/discover" className="drv-round sm" aria-label="Préférences de courses"><ArrowRight size={24} /></Link></div>
        <div className="drv-list">
          <Link href="/driver/earnings" className="drv-row"><BarChart3 size={22} /><span className="drv-row-label">Revenus</span><span className="drv-row-value">{today ? money(today.earnings) : '—'}</span><ChevronRight size={20} /></Link>
          <Link href="/driver/wallet" className="drv-row"><Wallet size={22} /><span className="drv-row-label">Portefeuille</span><span className="drv-row-value">{balance === null ? '—' : money(balance)}</span><ChevronRight size={20} /></Link>
          {!needsVehicle && <button className="drv-row" onClick={onTogglePet} disabled={togglingPet}><PawPrint size={22} /><span className="drv-row-label">StrasDrive Pet</span><span className={`drv-switch ${acceptsPet ? 'on' : ''}`} role="switch" aria-checked={acceptsPet}>{togglingPet ? <span className="spinner" /> : <span className="knob" />}</span></button>}
        </div>
      </div>
    </div>
    <div className="drv-cta-wrap">{needsVehicle ? <Link href="/driver/profile" className="drv-cta"><Car size={26} />Ajouter mon véhicule</Link> : <button className={`drv-cta ${online ? 'online' : ''}`} onClick={onToggle} disabled={busy || loading}>{busy ? <span className="spinner" /> : <><Power size={26} />{online ? 'Passer hors ligne' : 'Passer en ligne'}</>}</button>}</div>
    {expanded && <div className={`driver-status-panel ${online ? 'is-online' : ''}`}>
      <div className="driver-status-row"><Link href="/driver/preferences" aria-label="Préférences de conduite"><SlidersHorizontal size={26} /></Link><span role="status">{status}</span><button onClick={() => setToolsOpen(true)} aria-label="Options de conduite" aria-expanded={toolsOpen} aria-controls="driver-tools-panel"><List size={29} /></button></div>
    </div>}
    <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Rechercher sur la carte" keyboardSafe><PlaceSearch value={searchText} onChangeText={setSearchText} onSelect={(point) => { setSearchedPoint(point); setRecenterKey((k) => k + 1); setSearchOpen(false); }} bias={position || localPosition || center} autoFocus /></Modal>
    {toolsOpen && <section id="driver-tools-panel" className="driver-tools-panel" role="dialog" aria-modal="true" aria-label="Recommandé pour vous" ref={toolsPanelRef}>
      <header className="driver-tools-header">
        <button onClick={() => setToolsOpen(false)} aria-label="Fermer les recommandations"><ChevronDown size={28} /></button>
        <h2>Recommandé pour vous</h2>
        <button onClick={() => setToolsOpen(false)} aria-label="Retour à la carte"><List size={30} /></button>
      </header>
      <div className="driver-tools-content">
        <button className="driver-waybill-row" onClick={() => { setToolsOpen(false); onWaybill(); }}><FileText size={30} /><span>Waybill</span></button>
      </div>
      <footer className="driver-tools-footer">
        <Link href="/driver/preferences" aria-label="Préférences de conduite"><SlidersHorizontal size={30} /></Link>
        <button className="driver-tools-status" onClick={() => { setToolsOpen(false); onToggle(); }} disabled={busy || loading || needsVehicle} aria-label={online ? 'Passer hors ligne' : 'Passer en ligne'}>
          <span className="driver-tools-hand">{busy ? <span className="spinner" /> : <Hand size={45} fill="currentColor" />}</span>
          <span>{online ? 'EN LIGNE' : 'HORS LIGNE'}</span>
        </button>
        <button onClick={() => { setToolsOpen(false); setSearchOpen(true); }} aria-label="Rechercher une adresse sur la carte"><Search size={30} /></button>
      </footer>
    </section>}
  </div>;
}