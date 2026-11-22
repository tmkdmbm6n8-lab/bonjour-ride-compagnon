import { useState } from "react";
import { Plane, TrainFront, RefreshCw, Clock, MapPin } from "lucide-react";
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
  const [direction, setDirection] = useState("arrival");
  const [selected, setSelected] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [pickupText, setPickupText] = useState("");
  const [dropoffText, setDropoffText] = useState("");
  const [vehicleType, setVehicleType] = useState("economy");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState("");
  const { data, error, reload } = useDriverData("/api/riders/me/transport-board?day=" + parisDay());
  const items = (data?.items || []).filter(item => item.kind === kind && item.direction === direction);
  const dayLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date());
  function openTransport(item) {
    if (item.status === "cancelled" || item.status === "completed") return;
    const hub = item.kind === "flight" ? AIRPORT : STATION;
    setSelected(item);
    setErrorMessage("");
    setSuccess("");
    if (item.direction === "arrival") {
      setPickup({ ...hub, address: hub.name }); setPickupText(hub.name);
      setDropoff(null); setDropoffText("");
    } else {
      setDropoff({ ...hub, address: hub.name }); setDropoffText(hub.name);
      setPickup(null); setPickupText("");
    }
  }
  async function requestDriver() {
    if (!pickup || !dropoff || busy) return;
    setBusy(true); setErrorMessage("");
    try {
      const response = await apiFetch("/api/rides", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickup, dropoff, vehicleType, paymentMethod, favorite: false })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || "La recherche de chauffeur a échoué.");
      setSelected(null);
      setSuccess("Recherche lancée : la course est proposée aux chauffeurs disponibles selon leur proximité.");
    } catch (e) { setErrorMessage(e.message); }
    finally { setBusy(false); }
  }
  return <RiderLayout><div className="driver-tab-page discover-page drv-cockpit-page">
    <div className="driver-tab-title"><h1>Trafic</h1><button className="driver-icon-button" onClick={reload} aria-label="Actualiser"><RefreshCw size={20}/></button></div>
    <div className="drv-traffic-tabs" role="tablist">
      <button role="tab" aria-selected={kind === "flight"} className={"drv-traffic-tab " + (kind === "flight" ? "active" : "")} onClick={() => setKind("flight")}><Plane size={18}/><span>Aéroport d'Entzheim</span></button>
      <button role="tab" aria-selected={kind === "train"} className={"drv-traffic-tab " + (kind === "train" ? "active" : "")} onClick={() => setKind("train")}><TrainFront size={18}/><span>Gare Centrale</span></button>
    </div>
    <div className="drv-current-day-badge"><Clock size={14}/><span>Aujourd'hui · {dayLabel}</span></div>
    <div className="drv-direction-segmented">
      <button className={"drv-direction-btn " + (direction === "arrival" ? "active" : "")} onClick={() => setDirection("arrival")}>Arrivées</button>
      <button className={"drv-direction-btn " + (direction === "departure" ? "active" : "")} onClick={() => setDirection("departure")}>Départs</button>
    </div>
    {error && <div role="alert" className="driver-notice">{error}<button className="driver-chip" onClick={reload}>Réessayer</button></div>}
    {success && <p role="status">{success}</p>}
    {!data && !error && <Loading label="Réception des horaires…"/>}
    {data && !items.length && <p className="driver-empty-state">Aucun transport répertorié pour le moment.</p>}
    <div className="discover-events">{items.map(item => <article key={item.id} className="drv-traffic-card">
      <button className="drv-traffic-main" onClick={() => openTransport(item)}>
        <div className="drv-traffic-icon-box">{item.kind === "flight" ? <Plane size={22}/> : <TrainFront size={22}/>}</div>
        <div className="drv-traffic-info">
          <div className="drv-traffic-header-line"><span className="drv-traffic-time">{clock(item.scheduled)}{item.estimated && item.estimated !== item.scheduled ? <span className="drv-traffic-delay"> → {clock(item.estimated)}</span> : null}</span><span className={"transport-status " + (item.status === "cancelled" ? "cancelled" : item.status === "delayed" ? "delayed" : "")}>{item.statusText}</span></div>
          <h3>{item.number} · {item.city || "Strasbourg"}</h3>
          <p className="drv-traffic-sub">{item.carrier} {item.platform ? "· Voie " + item.platform : ""} {item.terminal ? "· T" + item.terminal : ""}</p>
        </div>
      </button>
    </article>)}</div>
    <Modal open={Boolean(selected)} onClose={() => { if (!busy) setSelected(null); }} title={selected ? selected.number + " · " + selected.city : ""} maxWidth={560}>
      {selected && <div style={{ display: "grid", gap: 16 }}>
        <p>{selected.direction === "arrival" ? "Prise en charge à l'arrivée" : "Transfert pour le départ"} · {clock(selected.estimated || selected.scheduled)}</p>
        <p>Voulez-vous chercher un chauffeur pour ce trajet ?</p>
        <label>Départ<PlaceSearch value={pickupText} onChangeText={t => { setPickupText(t); setPickup(null); }} onSelect={point => { setPickup(point); setPickupText(point.address); }} committedValue={pickup?.address} placeholder="Adresse de départ" icon={MapPin}/></label>
        <label>Destination<PlaceSearch value={dropoffText} onChangeText={t => { setDropoffText(t); setDropoff(null); }} onSelect={point => { setDropoff(point); setDropoffText(point.address); }} committedValue={dropoff?.address} placeholder="Adresse d'arrivée" icon={MapPin}/></label>
        <label>Véhicule<select value={vehicleType} onChange={e => setVehicleType(e.target.value)}><option value="economy">Économique</option><option value="comfort">Confort</option><option value="xl">XL</option><option value="pet">Animaux</option></select></label>
        <label>Paiement<select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="cash">Espèces</option><option value="wallet">Portefeuille</option><option value="card">Carte bancaire</option></select></label>
        {errorMessage && <p role="alert" style={{ color: "crimson" }}>{errorMessage}</p>}
        <button type="button" className="btn btn-primary" disabled={!pickup || !dropoff || busy || selected.status === "cancelled"} onClick={requestDriver}>{busy ? "Recherche…" : "Chercher un chauffeur"}</button>
      </div>}
    </Modal>
  </div></RiderLayout>;
}
