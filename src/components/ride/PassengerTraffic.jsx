import { useEffect, useRef, useState } from "react";
import { Plane, TrainFront, RefreshCw, Clock, MapPin, Car, LocateFixed, CalendarDays, Flag } from "lucide-react";
import RiderLayout from "@/components/RiderLayout";
import Modal from "@/components/ui/Modal";
import PlaceSearch from "@/components/maps/PlaceSearch";
import { Loading } from "@/components/ui/bits";
import useDriverData from "@/hooks/useDriverData";
import { apiFetch } from "@/lib/archive-fetch";
import { clock, parisDay } from "@/lib/vtc-dates";
import { AIRPORT, STATION } from "@/lib/vtc-transport";

export default function PassengerTraffic() {
  const [kind, setKind] = useState("flight");
  const [showReservations,setShowReservations] = useState(false);
  const [reservationLoading,setReservationLoading] = useState(true);
  const [reservationError,setReservationError] = useState("");
  const [direction, setDirection] = useState("arrival");
  const [selected, setSelected] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [pickupText, setPickupText] = useState("");
  const [dropoffText, setDropoffText] = useState("");
  const [vehicleType, setVehicleType] = useState("economy");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bookingMode, setBookingMode] = useState("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledRequests, setScheduledRequests] = useState([]);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [createdRide, setCreatedRide] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [locating, setLocating] = useState(false);
  const [cancelWhenReady, setCancelWhenReady] = useState(false);
  const cancelPendingRef = useRef(false);
  const { data, error, reload } = useDriverData("/api/riders/me/transport-board?day=" + parisDay());
  useEffect(() => {
    let active = true;
    async function loadReservations() {
      try {
        const response = await apiFetch("/api/riders/me/scheduled-requests");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Chargement impossible");
        if (active) { setScheduledRequests((result.requests || []).filter(item => item.kind === "transport" && item.status !== "canceled" && new Date(item.scheduled_at).getTime() > Date.now())); setReservationError(""); }
      } catch(e) {if(active) setReservationError(e.message);}
      finally {if(active) setReservationLoading(false);}
    }
    loadReservations();
    const timer = setInterval(loadReservations,30000);
    return () => {active=false;clearInterval(timer);};
  },[]);
  const items = (data?.items || []).filter(item => item.kind === kind && item.direction === direction && item.status !== "completed" && item.status !== "cancelled" && Date.parse(item.actual || item.estimated || item.scheduled) > Date.now());
  const dayLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date());
  function openTransport(item) {
    const hub = item.kind === "flight" ? AIRPORT : STATION;
    setSelected(item);
    setBookingMode("now");
    const at = new Date(item.estimated || item.scheduled);
    setScheduledAt(Number.isFinite(at.getTime()) ? new Date(at.getTime() - at.getTimezoneOffset()*60000).toISOString().slice(0,16) : "");
    setErrorMessage(item.status === "cancelled" ? "Ce transport est annulé : réservation indisponible." : item.status === "completed" ? "Ce transport est déjà terminé : choisissez un transport à venir pour réserver." : "");
    setSuccess("");
    if (item.direction === "arrival") {
      setPickup({ ...hub, address: hub.name }); setPickupText(hub.name);
      setDropoff(null); setDropoffText("");
    } else {
      setDropoff({ ...hub, address: hub.name }); setDropoffText(hub.name);
      setPickup(null); setPickupText("");
    }
  }
  async function locatePickup() {
    if (!navigator.geolocation) { setErrorMessage("Localisation indisponible sur cet appareil."); return; }
    setLocating(true); setErrorMessage("");
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      let address = "Position actuelle";
      try { const res = await apiFetch(`/api/geo/search?reverse=1&lat=${lat}&lng=${lng}`); const data = await res.json(); address = data.results?.[0]?.address || address; } catch { /* keep GPS coordinates */ }
      setPickup({ lat, lng, address }); setPickupText(address); setLocating(false);
    }, () => { setLocating(false); setErrorMessage("Impossible de vous localiser. Autorisez la localisation dans votre navigateur."); }, { enableHighAccuracy:true, timeout:10000, maximumAge:10000 });
  }
  async function requestDriver() {
    if (!pickup || !dropoff || busy) return;
    cancelPendingRef.current = false;
    setBusy(true); setCancelWhenReady(false); setErrorMessage("");
    setSelected(null);
    try {
      const response = await apiFetch("/api/rides", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickup, dropoff, vehicleType, paymentMethod, favorite: false })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || "La recherche de chauffeur a échoué.");
      // The dashboard already owns the live search animation, driver updates and cancellation flow.
      // Navigate only after the ride was successfully created so it can resume the active ride.
      if (!result.ride?.id) throw new Error("Le serveur n’a pas confirmé la création de la course.");
      setCreatedRide(result.ride);
      if (cancelPendingRef.current) {
        // The ride exists now: cancelling is safe even if the user closed the pending search.
        const cancelled = await apiFetch(`/api/rides/${result.ride.id}/cancel`, {method:"POST",body:JSON.stringify({reason:"Annulation par le passager"})});
        if (cancelled.ok) { setCreatedRide(null); setSuccess("Votre demande a été annulée."); }
      }
    } catch (e) { setErrorMessage(e.message); setSuccess(""); setSelected(previous => previous || {number:"Demande",city:"Réessayer",direction:"arrival",scheduled:new Date().toISOString()}); }
    finally { setBusy(false); }
  }
  async function scheduleTransport() {
    if (!selected || !pickup?.address || !dropoff?.address || scheduleBusy) return;
    const when = new Date(scheduledAt);
    if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) { setErrorMessage("Choisissez une date et une heure futures."); return; }
    setScheduleBusy(true); setErrorMessage("");
    try {
      const response = await apiFetch("/api/riders/me/scheduled-requests", {method:"POST",body:JSON.stringify({
        kind:"transport",pickupAddress:pickup.address,dropoffAddress:dropoff.address,
        transportType:selected.kind,transportNumber:selected.number,scheduledAt:when.toISOString(),paymentMethod
      })});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Enregistrement impossible");
      setScheduledRequests(current => [result.request,...current]);
      setShowReservations(true);
      setSelected(null);
      setSuccess("Réservation anticipée enregistrée pour le " + when.toLocaleString("fr-FR") + ". Aucun chauffeur n'est encore confirmé.");
    } catch(e) { setErrorMessage(e.message); }
    finally { setScheduleBusy(false); }
  }
  async function cancelScheduled(id) {
    const response = await apiFetch("/api/riders/me/scheduled-requests", {method:"DELETE",body:JSON.stringify({id})});
    const result = await response.json();
    if (!response.ok) { setSuccess(result.error || "Annulation impossible"); return; }
    setScheduledRequests(current => current.filter(item => item.id !== id));
    setSuccess("Réservation anticipée annulée.");
  }
  async function cancelSearch() {
    if (!createdRide?.id) { cancelPendingRef.current = true; setCancelWhenReady(true); setSuccess("Annulation demandée. La course sera annulée dès sa confirmation."); return; }
    if (cancelling) return;
    setCancelling(true);
    try {
      const response = await apiFetch(`/api/rides/${createdRide.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "Annulation par le passager" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Annulation impossible");
      setCreatedRide(null);
      setSuccess("Votre demande a été annulée.");
    } catch (e) { setErrorMessage(e.message); }
    finally { setCancelling(false); }
  }
  return <RiderLayout><div className="driver-tab-page discover-page drv-cockpit-page">
    <div className="driver-tab-title"><h1>Trafic</h1><button className="driver-icon-button" onClick={reload} aria-label="Actualiser"><RefreshCw size={20}/></button></div>
    <button type="button" className="drv-traffic-tab" onClick={() => setShowReservations(v => !v)} style={{width:"100%",display:"flex",justifyContent:"center",alignItems:"center",gap:9,marginBottom:14,border:showReservations ? "1px solid #e9bd50" : undefined,color:showReservations ? "#e9bd50" : undefined}}><CalendarDays size={18}/> Mes réservations {scheduledRequests.length > 0 ? `(${scheduledRequests.length})` : ""}</button>
    {!showReservations && <><div className="drv-traffic-tabs" role="tablist">
      <button role="tab" aria-selected={kind === "flight"} className={"drv-traffic-tab " + (kind === "flight" ? "active" : "")} onClick={() => setKind("flight")}><Plane size={18}/><span>Aéroport d'Entzheim</span></button>
      <button role="tab" aria-selected={kind === "train"} className={"drv-traffic-tab " + (kind === "train" ? "active" : "")} onClick={() => setKind("train")}><TrainFront size={18}/><span>Gare Centrale</span></button>
    </div>
    </>}
    {!showReservations && <div className="drv-current-day-badge"><Clock size={14}/><span>Aujourd'hui · {dayLabel}</span></div>
    {!showReservations && <div className="drv-direction-segmented">
      <button className={"drv-direction-btn " + (direction === "arrival" ? "active" : "")} onClick={() => setDirection("arrival")}>Arrivées</button>
      <button className={"drv-direction-btn " + (direction === "departure" ? "active" : "")} onClick={() => setDirection("departure")}>Départs</button>
    </div>}
    {error && <div role="alert" className="driver-notice">{error}<button className="driver-chip" onClick={reload}>Réessayer</button></div>}
    {success && <p role="status">{success}</p>}
    {showReservations && <section style={{display:"grid",gap:12,marginBlock:14}}>
      {reservationLoading && <p>Chargement des réservations…</p>}
      {reservationError && <p role="alert">{reservationError}</p>}
      {!reservationLoading && !scheduledRequests.length && <p className="driver-empty-state">Aucune réservation à venir.</p>}
      {scheduledRequests.map(req => <article key={req.id} style={{padding:18,border:"1px solid rgba(212,160,23,.3)",background:"#11141c",color:"#fff",borderRadius:18}}>
        <div style={{display:"flex",gap:8,alignItems:"center",color:"#facc15",fontWeight:700}}>{req.transport_type === "flight" ? <Plane size={19}/> : <TrainFront size={19}/>} Réservation <span style={{marginLeft:"auto",fontSize:12,color:"#a8b2c3"}}>{req.transport_number}</span></div>
        <p style={{fontWeight:700,margin:"12px 0"}}>{new Date(req.scheduled_at).toLocaleString("fr-FR",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"})}</p>
        <p style={{display:"flex",gap:8,alignItems:"flex-start"}}><MapPin size={17} color="#39ff88"/>{req.pickup_address}</p>
        <p style={{display:"flex",gap:8,alignItems:"flex-start",marginTop:8}}><Flag size={17} color="#ff657c"/>{req.dropoff_address}</p>
        <p style={{fontSize:12,color:req.status === "confirmed" ? "#39ff88" : "#e9bd50",margin:"12px 0"}}>{req.status === "confirmed" ? "Chauffeur attribué" : "En attente d’un chauffeur"}</p>
        {req.status === "pending" && <button className="btn btn-secondary" type="button" onClick={()=>cancelScheduled(req.id)}>Annuler la réservation</button>}
      </article>)}
    </section>}
    {(busy || createdRide) && <div className="overlay" role="dialog" aria-modal="true" aria-label="Recherche de chauffeur"><div className="modal modal-pad" style={{maxWidth:440,textAlign:"center"}}><div className="pulse-ring" style={{width:72,height:72,borderRadius:"50%",display:"grid",placeItems:"center",margin:"12px auto 24px",background:"var(--ink-950)"}}><Car size={30} color="#fff"/></div><h3>Recherche de votre chauffeur…</h3><p className="small muted mt-2">{busy ? "Préparation de votre demande…" : "Nous contactons les chauffeurs proches de votre point de prise en charge."}</p>{errorMessage && <p role="alert" style={{color:"crimson"}}>{errorMessage}</p>}<button type="button" className="btn btn-secondary btn-full mt-6" disabled={cancelling || cancelWhenReady} onClick={cancelSearch}>{cancelling ? "Annulation…" : cancelWhenReady ? "Annulation demandée…" : "Annuler la demande"}</button>{createdRide && <button type="button" className="btn btn-primary btn-full mt-3" onClick={() => window.location.assign("/dashboard")}>Suivre ma course sur la carte</button>}</div></div>}
    {!showReservations && !data && !error && <Loading label="Réception des horaires…"/>}
    {!showReservations && data && !items.length && <p className="driver-empty-state">Aucun transport répertorié pour le moment.</p>}
    {!showReservations && <div className="discover-events">{items.map(item => <article key={item.id} className="drv-traffic-card">
      <button className="drv-traffic-main" onClick={() => openTransport(item)}>
        <div className="drv-traffic-icon-box">{item.kind === "flight" ? <Plane size={22}/> : <TrainFront size={22}/>}</div>
        <div className="drv-traffic-info">
          <div className="drv-traffic-header-line"><span className="drv-traffic-time">{clock(item.scheduled)}{item.estimated && item.estimated !== item.scheduled ? <span className="drv-traffic-delay"> → {clock(item.estimated)}</span> : null}</span><span className={"transport-status " + (item.status === "cancelled" ? "cancelled" : item.status === "delayed" ? "delayed" : "")}>{item.statusText}</span></div>
          <h3>{item.number} · {item.city || "Strasbourg"}</h3>
          <p className="drv-traffic-sub">{item.carrier} {item.platform ? "· Voie " + item.platform : ""} {item.terminal ? "· T" + item.terminal : ""}</p>
        </div>
      </button>
    </article>)}</div>}
    <Modal portal keyboardSafe open={Boolean(selected)} onClose={() => { if (!busy) setSelected(null); }} title={selected ? selected.number + " · " + selected.city : ""} maxWidth={560}>
      {selected && <div style={{ display: "grid", gap: 16 }}>
        <p>{selected.direction === "arrival" ? "Prise en charge à l'arrivée" : "Transfert pour le départ"} · {clock(selected.estimated || selected.scheduled)}</p>
        <p>Choisissez quand vous souhaitez effectuer ce trajet.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button type="button" className={"btn "+(bookingMode === "now" ? "btn-primary":"btn-secondary")} onClick={()=>setBookingMode("now")}>Maintenant</button><button type="button" className={"btn "+(bookingMode === "later" ? "btn-primary":"btn-secondary")} onClick={()=>setBookingMode("later")}>Réserver à l’avance</button></div>
        <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:6}}><strong>Départ</strong><button type="button" className="btn btn-secondary" style={{padding:"7px 10px",fontSize:13}} onClick={locatePickup} disabled={locating}><LocateFixed size={16}/>{locating ? "Localisation…" : "Ma position"}</button></div><PlaceSearch value={pickupText} onChangeText={t => { setPickupText(t); setPickup(null); }} onSelect={point => { setPickup(point); setPickupText(point.address); }} committedValue={pickup?.address} placeholder="Adresse de départ" icon={MapPin}/></div>
        <label>Destination<PlaceSearch value={dropoffText} onChangeText={t => { setDropoffText(t); setDropoff(null); }} onSelect={point => { setDropoff(point); setDropoffText(point.address); }} committedValue={dropoff?.address} placeholder="Adresse d'arrivée" icon={MapPin}/></label>
        {bookingMode === "later" && <label style={{display:"grid",gap:8,fontWeight:600}}>Date et heure de prise en charge<input className="input" type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}/></label>}
        {bookingMode === "now" && <label style={{display:"grid",gap:8,fontWeight:600}}>Véhicule<select className="input" style={{width:"100%",minWidth:0,display:"block",fontWeight:500}} value={vehicleType} onChange={e => setVehicleType(e.target.value)}><option value="economy">Économique</option><option value="comfort">Confort</option><option value="xl">XL</option><option value="pet">Animaux</option></select></label>}
        <label style={{display:"grid",gap:8,fontWeight:600}}>Paiement<select className="input" style={{width:"100%",minWidth:0,display:"block",fontWeight:500}} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="cash">Espèces</option><option value="wallet">Portefeuille</option><option value="card">Carte bancaire</option></select></label>
        {errorMessage && <p role="alert" style={{ color: "crimson" }}>{errorMessage}</p>}
        {bookingMode === "now" ? <button type="button" className="btn btn-primary" disabled={!pickup || !dropoff || busy || selected.status === "cancelled" || selected.status === "completed"} onClick={requestDriver}>{busy ? "Recherche…" : "Chercher un chauffeur"}</button> : <><p className="small muted">La demande sera enregistrée pour plus tard. Aucun chauffeur ne sera recherché immédiatement.</p><button type="button" className="btn btn-primary" disabled={!pickup || !dropoff || scheduleBusy} onClick={scheduleTransport}>{scheduleBusy ? "Enregistrement…" : "Enregistrer la réservation"}</button></>}
      </div>}
    </Modal>
  </div></RiderLayout>;
}
