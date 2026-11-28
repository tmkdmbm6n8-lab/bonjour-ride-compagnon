import FleetManager, { FleetReviews } from "./FleetManager";
import "@/styles/fleet-desk.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signOut, useSession } from "@/lib/archive-auth";
import MapView from "@/components/maps/MapView";
import { recallRead, rememberRead } from "@/lib/offline-cache";
import { warmOfflinePages } from "@/lib/offline-shell";

export const fleetUrl = "/contact?topic=fleet";
const money = value => Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const city = { lat: 48.583, lng: 7.747 };

const FLEET_VIEW_KEY = "/fleet/view";

async function request(action, payload = {}) {
  let result;
  try { result = await supabase.rpc("sd_fleet", { action, payload }); }
  catch (e) { result = { error: e }; }
  const { data, error } = result;
  if (error) {
    // Without network the fleet desk keeps showing its last saved view.
    const saved = action === "view" ? recallRead(FLEET_VIEW_KEY) : undefined;
    if (saved !== undefined && (navigator.onLine === false || /fetch|network|load failed|offline/i.test(String(error.message)))) return saved;
    throw new Error(error.message);
  }
  if (action === "view") rememberRead(FLEET_VIEW_KEY, data);
  return data;
}

export function FleetActivation() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function activate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    try {
      await request("activate", Object.fromEntries(new FormData(form)));
      form.reset();
      setMessage("Flotte activée. Le gérant peut se connecter avec son compte.");
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  return <details className="card card-pad"><summary>Activer une société de flotte</summary>
    <form className="flex-col gap-3 mt-4" onSubmit={activate}>
      <label className="field">Raison sociale<input className="input" name="name" minLength={2} maxLength={150} required /></label>
      <label className="field">E-mail du compte gérant confirmé<input className="input" type="email" name="email" required /></label>
      <button disabled={busy} className="btn btn-primary">Activer la flotte</button>
      <p role="status">{message}</p>
    </form><FleetReviews /></details>;
}

export default function FleetWorkspace() {
  const { data, status } = useSession();
  const id = data?.user?.id;
  return <div className="landing-page brand-theme" style={{ minHeight: "100dvh", padding: "24px 16px" }}>
    <main className="flex-col gap-4" style={{ maxWidth: 840, margin: "0 auto" }}>
      <a href="/" className="small muted">StrasDrive</a>
      {id ? <FleetAccount key={id} /> : status === "loading" ? <p>Chargement…</p> :
        <a href={"/login?callbackUrl=" + encodeURIComponent(fleetUrl)} className="btn btn-primary">Se connecter à ma flotte</a>}
    </main></div>;
}

function FleetAccount() {
  const [fleet, setFleet] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const locked = useRef(false);
  const refresh = useCallback(async () => {
    if (locked.current) return;
    const version = ++sequence.current;
    try {
      const result = await request("view");
      if (version === sequence.current) setFleet(result);
    } catch (e) { if (version === sequence.current) setError(e.message); }
  }, []);
  useEffect(() => { void warmOfflinePages(["/", fleetUrl]); }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { clearInterval(timer); sequence.current++; };
  }, [refresh]);
  async function act(action, payload, form) {
    if (locked.current) return;
    locked.current = true;
    sequence.current++;
    setBusy(true); setError("");
    try { setFleet(await request(action,payload)); form?.reset(); }
    catch (e) { setError(e.message); }
    finally { locked.current = false; setBusy(false); refresh(); }
  }
  function submit(action) {
    return event => {
      event.preventDefault();
      const form = event.currentTarget;
      act(action,Object.fromEntries(new FormData(form)),form);
    };
  }
  const manager = fleet?.role === "manager";
  const joined = manager || fleet?.role === "driver";
  const vehicles = fleet?.vehicles || [];
  const drivers = fleet?.drivers || [];
  const mine = vehicles.find(v => v.driver === fleet?.me);
  if (manager) return <>{error && <p role="alert">{error}</p>}<FleetManager fleet={fleet} act={act} busy={busy} submit={submit}/></>;
  return <>
    <h1>{fleet?.name || "Ma flotte"}</h1>
    {error && <p role="alert" className="input-error-msg">{error}</p>}
    {!fleet && !error && <p>Chargement…</p>}
    {fleet?.role === "none" && <p>Aucun rattachement pour ce compte. Votre gérant peut vous inviter avec votre adresse e-mail chauffeur.</p>}
    {fleet?.role === "invited" && <section className="card card-pad"><h2>Invitation à rejoindre {fleet.name}</h2>
      <div className="flex wrap gap-2"><button disabled={busy} className="btn btn-primary" onClick={() => act("accept")}>Accepter</button>
      <button disabled={busy} className="btn btn-secondary" onClick={() => act("decline")}>Refuser</button></div></section>}
    {joined && <section className="card card-pad flex-col gap-3"><h2>Véhicules</h2>
      {!vehicles.length && <p>Aucun véhicule enregistré.</p>}
      {vehicles.map(v => <div key={v.id} className="flex wrap justify-between items-center gap-2">
        <div><strong>{v.model}</strong><p className="small muted">{v.plate} · {v.taken ? drivers.find(d => d.id === v.driver)?.name || "Occupé" : "Disponible"}</p></div>
        {v.taken && (manager || v.driver === fleet.me) && <button disabled={busy} className="btn btn-secondary" onClick={() => act("release",{id:v.id,driver:v.driver})}>Libérer</button>}
        {!manager && !mine && !v.taken && <button disabled={busy} className="btn btn-primary" onClick={() => act("claim",{id:v.id})}>Choisir</button>}
      </div>)}
      {manager && <form className="flex-col gap-2" onSubmit={submit("vehicle")}>
        <label className="field">Marque et modèle<input className="input" name="model" required maxLength={100} /></label>
        <label className="field">Immatriculation<input className="input" name="plate" required maxLength={15} /></label>
        <button disabled={busy} className="btn btn-primary">Ajouter le véhicule</button>
      </form>}</section>}
    {manager ? <button className="btn btn-secondary" onClick={() => signOut({callbackUrl:"/login"})}>Se déconnecter</button> : <a className="btn btn-secondary" href="/driver/menu">Retour au menu chauffeur</a>}
  </>;
}
