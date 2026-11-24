import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plane, TrainFront, MapPin, Flag } from "lucide-react";
import DriverLayout from "@/components/DriverLayout";
import { apiFetch } from "@/lib/archive-fetch";

function DriverReservations() {
  const [items,setItems] = useState([]);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  async function cancel(id) {
    if (!window.confirm("Annuler cette réservation ? Elle sera proposée à un autre chauffeur.")) return;
    const response = await apiFetch("/api/drivers/me/accepted-reservations/cancel",{method:"POST",body:JSON.stringify({id})});
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Annulation impossible"); return; }
    setItems(current => current.filter(item => item.id !== id));
  }
  async function acceptChange(id) {
    try {
      const response = await apiFetch("/api/drivers/me/accepted-reservations/confirm-change",{method:"POST",body:JSON.stringify({id})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Confirmation impossible");
      setItems(current => current.map(item => item.id === id ? {...item,status:"confirmed"} : item));
      setError("");
    } catch(e) {setError(e.message);}
  }
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch("/api/drivers/me/accepted-reservations");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Chargement impossible");
        if (active) { setItems(data.reservations || []); setError(""); }
      } catch(e) { if (active) setError(e.message); }
      finally { if (active) setLoading(false); }
    }
    load();
    const timer = setInterval(load,30000);
    return () => {active=false;clearInterval(timer);};
  },[]);
  return <DriverLayout><main className="driver-tab-page drv-cockpit-page">
    <header className="driver-account-heading">
      <div>
        <span className="sd-settings-brand">Espace chauffeur</span>
        <h1>Réservations</h1>
      </div>
    </header>
    <section className="card card-pad" aria-labelledby="driver-reservations-title">
      <h2 id="driver-reservations-title">Vos réservations</h2>
      {loading && <p className="small muted mt-3" role="status">Chargement des réservations…</p>}
      {error && <p role="alert" style={{color:"#ff6581"}}>{error}</p>}
      {!loading && !error && !items.length && <p className="small muted mt-3">Aucune réservation acceptée à venir.</p>}
      <div className="flex-col gap-3 mt-4">{items.map(item => <article key={item.id} className="card card-pad">
        <div style={{display:"flex",alignItems:"center",gap:8,color:"#facc15",fontWeight:700}}>{item.transport_type === "flight" ? <Plane size={19}/> : <TrainFront size={19}/>} Réservation <span style={{marginLeft:"auto",fontSize:12,color:"#a8b2c3"}}>{item.transport_number}</span></div>
        <p style={{fontWeight:700,margin:"12px 0"}}>{new Date(item.scheduled_at).toLocaleString("fr-FR",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"})}</p>
        <p style={{display:"flex",gap:8,alignItems:"flex-start"}}><MapPin size={17} color="#39ff88"/>{item.pickup_address}</p>
        <p style={{display:"flex",gap:8,alignItems:"flex-start",marginTop:8}}><Flag size={17} color="#ff657c"/>{item.dropoff_address}</p>
        {item.status === "modified_pending" ? <div style={{background:"rgba(250,204,21,0.12)",border:"1px solid #facc15",borderRadius:12,padding:12,margin:"12px 0"}}>
          <p style={{color:"#facc15",fontWeight:700,fontSize:13,marginBottom:8}}>⚠️ Le client a modifié les horaires ou adresses</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <button type="button" className="btn btn-primary" onClick={()=>acceptChange(item.id)}>Confirmer</button>
            <button type="button" className="btn btn-secondary" onClick={()=>cancel(item.id)}>Refuser</button>
          </div>
        </div> : <p style={{fontSize:12,color:"#39ff88",margin:"12px 0"}}>Acceptée{item.estimated_price != null ? " · "+Number(item.estimated_price).toFixed(2).replace(".",",")+" €" : ""}</p>}
        {item.status !== "modified_pending" && <button type="button" className="btn btn-secondary" onClick={()=>cancel(item.id)}>Annuler la réservation</button>}
      </article>)}</div>
    </section>
  </main></DriverLayout>;
}
export const Route = createFileRoute("/_authenticated/driver/reservations")({head: () => ({ meta: [{"title": "Réservations chauffeur · StrasDrive"}, {"name": "description", "content": "Consultez et confirmez vos réservations à venir et leurs modifications sur StrasDrive."}, {"property": "og:title", "content": "Réservations chauffeur · StrasDrive"}, {"property": "og:description", "content": "Consultez et confirmez vos réservations à venir et leurs modifications sur StrasDrive."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }), component:DriverReservations});
