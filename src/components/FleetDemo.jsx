import { useState } from "react";
import MapView from "@/components/maps/MapView";
import { KovaLogo } from "@/components/brand/KovaLogo";

const sections = ["Vue d’ensemble", "Chauffeurs", "Véhicules", "Revenus"];
const center = { lat: 48.583, lng: 7.747 };
const initialDrivers = [
  { id: "sarah", name: "Sarah", status: "En course", location: center },
  { id: "yanis", name: "Yanis", status: "Disponible", location: { lat: 48.59, lng: 7.738 } },
  { id: "lea", name: "Léa", status: "Hors ligne" },
];
const initialVehicles = [
  { id: "v1", name: "Peugeot 508", driver: "sarah" },
  { id: "v2", name: "Tesla Model 3", driver: "yanis" },
  { id: "v3", name: "Toyota Corolla", driver: "" },
];
const trips = [
  { driver: "Sarah", vehicle: "Peugeot 508", gross: 2450, fee: 245 },
  { driver: "Yanis", vehicle: "Tesla Model 3", gross: 1860, fee: 93 },
  { driver: "Sarah", vehicle: "Peugeot 508", gross: 1580, fee: 0 },
];
const euros = cents => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function FleetDemo({ onExit }) {
  const [section, setSection] = useState(sections[0]);
  const [drivers, setDrivers] = useState(initialDrivers);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [filter, setFilter] = useState("");
  const online = drivers.filter(d => d.location);
  const rows = trips.filter(t => !filter || [t.driver, t.vehicle].includes(filter));
  const net = rows.reduce((sum, t) => sum + t.gross - t.fee, 0);

  function add(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name")).trim();
    if (!name) return;
    const id = crypto.randomUUID();
    if (section === "Chauffeurs") setDrivers([...drivers, { id, name, status: "Invitation simulée" }]);
    else setVehicles([...vehicles, { id, name, driver: "" }]);
    form.reset();
  }

  function removeDriver(id) {
    setDrivers(drivers.filter(d => d.id !== id));
    setVehicles(vehicles.map(v => v.driver === id ? { ...v, driver: "" } : v));
  }

  return <main className="landing-page brand-theme" style={{ minHeight: "100dvh", padding: "24px 16px" }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }} className="flex-col gap-4">
      <header className="flex wrap items-center justify-between gap-3">
        <KovaLogo size={32} />
        <button className="btn btn-secondary btn-sm" onClick={onExit}>Quitter la démo</button>
      </header>
      <div><h1>Ma flotte</h1><p className="small muted">Démonstration · Données fictives à Strasbourg</p></div>
      <nav aria-label="Gestion de flotte" className="flex wrap gap-2">
        {sections.map(s => <button key={s} aria-pressed={section === s} className={section === s ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setSection(s)}>{s}</button>)}
      </nav>
      {section === sections[0] && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 12 }}>
          {[[online.length,"En ligne"],[drivers.filter(d => d.status === "En course").length,"En course"],[drivers.filter(d => d.status === "Disponible").length,"Disponibles"],[trips.length,"Courses terminées"]].map(([value,label]) =>
            <div className="card card-pad" key={label}><strong style={{ fontSize: "1.75rem", color: "var(--gold-500)" }}>{value}</strong><div>{label}</div></div>)}
        </div>
        <section className="card card-pad"><h2>Chauffeurs en ligne</h2>
          <MapView center={center} drivers={online} style={{ height: 260, borderRadius: 16, marginBlock: 12 }} />
          {online.map(d => <details key={d.id}><summary>{d.name} · {d.status}</summary><p>{vehicles.find(v => v.driver === d.id)?.name || "Aucun véhicule affecté"}</p></details>)}
        </section>
      </>}
      {["Chauffeurs","Véhicules"].includes(section) && <section className="card card-pad flex-col gap-4">
        <h2>{section}</h2>
        <form key={section} onSubmit={add} className="flex wrap gap-2">
          <input name="name" className="input" required maxLength={80} aria-label={section === "Chauffeurs" ? "Nom du chauffeur" : "Modèle du véhicule"} placeholder={section === "Chauffeurs" ? "Nom du chauffeur" : "Modèle du véhicule"} />
          <button className="btn btn-primary">{section === "Chauffeurs" ? "Simuler une invitation" : "Ajouter le véhicule"}</button>
        </form>
        {section === "Chauffeurs" ? drivers.map(d => <div key={d.id} className="flex wrap items-center justify-between gap-2"><span>{d.name} · {d.status}</span><button className="btn btn-secondary btn-sm" onClick={() => removeDriver(d.id)}>Retirer</button></div>)
          : vehicles.map(v => <label key={v.id} className="field">{v.name}
            <select className="input" value={v.driver} onChange={e => {
              const id = e.target.value;
              setVehicles(vehicles.map(item => item.id === v.id ? { ...item, driver: id } : id && item.driver === id ? { ...item, driver: "" } : item));
            }}><option value="">Non affecté</option>{drivers.filter(d => d.status !== "Invitation simulée").map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </label>)}
      </section>}
      {section === "Revenus" && <section className="card card-pad flex-col gap-3"><h2>Revenus du jour</h2>
        <label className="field">Chauffeur ou véhicule<select className="input" value={filter} onChange={e => setFilter(e.target.value)}><option value="">Toute la flotte</option>{[...new Set(trips.flatMap(t => [t.driver,t.vehicle]))].map(v => <option key={v}>{v}</option>)}</select></label>
        {rows.map((t,i) => <div key={i}><strong>{t.driver} · {t.vehicle}</strong><p className="small muted">{euros(t.gross)} de course · {euros(t.fee)} de commission</p></div>)}
        <strong>Revenu net · {euros(net)}</strong>
      </section>}
    </div>
  </main>;
}
