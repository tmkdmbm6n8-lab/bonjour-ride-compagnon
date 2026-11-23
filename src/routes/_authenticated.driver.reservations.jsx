import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Plane, TrainFront, MapPin, Flag } from "lucide-react";
import DriverLayout from "@/components/DriverLayout";
import { apiFetch } from "@/lib/archive-fetch";

function DriverReservations() {
  const [items,setItems] = useState([]);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
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
  return <DriverLayout><main className="driver-tab-page" style={{padding:"20px 16px",maxWidth:640,margin:"0 auto"}}>
    <h1 style={{display:"flex",gap:10,alignItems:"center"}}><CalendarDays size={25} color="#facc15"/> Réservations</h1>
    <p style={{color:"var(--muted,#9ca3af)",margin:"12px 0 20px"}}>Vos réservations acceptées à venir</p>
    {loading && <p>Chargement des réservations…</p>}
    {error && <p role="alert" style={{color:"#ff6581"}}>{error}</p>}
    {!loading && !error && !items.length && <p>Aucune réservation acceptée à venir.</p>}
    <div style={{display:"grid",gap:12}}>{items.map(item => <article key={item.id} style={{background:"#11141c",border:"1px solid rgba(212,160,23,.3)",borderRadius:18,padding:18,color:"#fff"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,color:"#facc15",fontWeight:700}}>{item.transport_type === "flight" ? <Plane size={19}/> : <TrainFront size={19}/>} Réservation <span style={{marginLeft:"auto",fontSize:12,color:"#a8b2c3"}}>{item.transport_number}</span></div>
      <p style={{fontWeight:700,margin:"12px 0"}}>{new Date(item.scheduled_at).toLocaleString("fr-FR",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"})}</p>
      <p style={{display:"flex",gap:8,alignItems:"flex-start"}}><MapPin size={17} color="#39ff88"/>{item.pickup_address}</p>
      <p style={{display:"flex",gap:8,alignItems:"flex-start",marginTop:8}}><Flag size={17} color="#ff657c"/>{item.dropoff_address}</p>
      <p style={{fontSize:12,color:"#39ff88",marginTop:12}}>Acceptée</p>
    </article>)}</div>
  </main></DriverLayout>;
}
export const Route = createFileRoute("/_authenticated/driver/reservations")({component:DriverReservations});
