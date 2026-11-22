import { useEffect, useState } from "react";
import RiderLayout from "@/components/RiderLayout";

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const API = "/api/riders/me/scheduled-requests";

export default function ScheduledRequestsPage({ kind }) {
  const transport = kind === "transport";
  const [form, setForm] = useState({ pickupAddress: "", dropoffAddress: "", transportType: "flight", transportNumber: "", scheduledAt: "", weekday: "1", localTime: "07:00", adjustmentConsent: false });
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  async function load() {
    try {
      const response = await fetch(API);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de charger les demandes");
      setItems((data.requests || []).filter((r) => r.kind === kind));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [kind]);
  useEffect(() => {
    if (!transport) return;
    fetch("/api/riders/me/transport-board").then(r => r.json()).then(d => setBoard(d.items || [])).catch(() => setBoard([]));
  }, [kind]);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (transport && !selectedId) throw new Error("Sélectionnez un vol ou un train.");
      const payload = { ...form, kind, weekday: Number(form.weekday), scheduledAt: transport ? new Date(form.scheduledAt).toISOString() : undefined };
      const response = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible");
      setMessage("Demande enregistrée. Elle n'est pas encore une course confirmée.");
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function cancel(id) {
    setBusy(true); setError("");
    try {
      const response = await fetch(API, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error("Annulation impossible");
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const field = { display: "block", width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 10, border: "1px solid #9ca3af", background: "transparent", color: "inherit" };
  return <RiderLayout><main style={{ padding: "22px 16px", maxWidth: 620, margin: "0 auto" }}>
    <h1>{transport ? "Vols et trains" : "Trajets récurrents"}</h1>
    <p>{transport ? "Préparez un transfert depuis une gare ou un aéroport." : "Préparez un trajet hebdomadaire accessible à tous les chauffeurs disponibles, avec ou sans abonnement."}</p>
    {transport && <section><h2>Vols et trains</h2>{board.map(item => <button key={item.id} type="button" disabled={item.status === "cancelled" || item.status === "completed"} onClick={() => { setSelectedId(item.id); setForm(f => ({ ...f, transportType: item.kind, transportNumber: item.number, scheduledAt: new Date(item.estimated || item.scheduled).toISOString().slice(0,16) })); }} style={{ display: "block", padding: 12, marginBottom: 8, width: "100%", border: selectedId === item.id ? "2px solid green" : "1px solid gray", borderRadius: 8 }}><strong>{item.kind === "flight" ? "Vol" : "Train"} {item.number}</strong> · {item.direction === "arrival" ? "Retour" : "Aller"} · {item.city} · {new Date(item.estimated || item.scheduled).toLocaleTimeString("fr-FR")}</button>)}</section>}
    <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 20 }}>
      <label>Adresse de départ<input style={field} required minLength={5} maxLength={240} value={form.pickupAddress} onChange={(e) => update("pickupAddress", e.target.value)} placeholder="Adresse complète" /></label>
      <label>Adresse d'arrivée<input style={field} required minLength={5} maxLength={240} value={form.dropoffAddress} onChange={(e) => update("dropoffAddress", e.target.value)} placeholder="Adresse complète" /></label>
      {transport ? <>
        <p>Sélectionnez un vol ou un train dans la liste.</p>
      </> : <>
        <label>Jour de la semaine<select style={field} value={form.weekday} onChange={(e) => update("weekday", e.target.value)}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
        <label>Heure habituelle<input style={field} type="time" required value={form.localTime} onChange={(e) => update("localTime", e.target.value)} /></label>
      </>}
      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {message && <p role="status">{message}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Enregistrement…" : "Enregistrer ma demande"}</button>
    </form>
    <h2 style={{ marginTop: 32 }}>Mes demandes</h2>
    {!items.length && <p>Aucune demande enregistrée.</p>}
    {items.map((item) => <article key={item.id} style={{ padding: 14, marginTop: 12, border: "1px solid #9ca3af", borderRadius: 12 }}>
      <strong>{item.pickup_address} → {item.dropoff_address}</strong>
      <p>{transport ? `${item.transport_type === "flight" ? "Vol" : "Train"} ${item.transport_number} · ${new Date(item.scheduled_at).toLocaleString("fr-FR")}` : `${DAYS[item.weekday]} à ${String(item.local_time).slice(0,5)}`}</p>
      <p>Statut : {item.status === "pending" ? "En attente" : item.status === "canceled" ? "Annulée" : "Confirmée"}</p>
      {item.status === "pending" && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => cancel(item.id)}>Annuler la demande</button>}
    </article>)}
  </main></RiderLayout>;
}
