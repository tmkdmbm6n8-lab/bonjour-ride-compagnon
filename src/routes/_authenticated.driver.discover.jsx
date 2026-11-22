import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plane, TrainFront, Bookmark, RefreshCw, BellRing, Clock } from "lucide-react";
import DriverLayout, { useDriverGold } from "@/components/DriverLayout";
import Link from "@/lib/archive-navigation";
import Modal from "@/components/ui/Modal";
import { Loading } from "@/components/ui/bits";
import useDriverData from "@/hooks/useDriverData";
import { useSession } from "@/lib/archive-auth";
import { clock, parisDay } from "@/lib/vtc-dates";
import { transportChanges } from "@/lib/vtc-transport";

function DiscoverPage() {
  const day = parisDay(); // Uniquement la journée actuelle en temps réel
  const [kind, setKind] = useState("flight"); // 2 choix uniques : 'flight' (Aéroport) ou 'train' (Gare)
  const [direction, setDirection] = useState("arrival");
  const [saved, setSaved] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [changes, setChanges] = useState([]);
  const previous = useRef(null);
  const { data: session } = useSession();
  const storageKey = `strasdrive:saved-transports:${session?.user?.id || "account"}`;
  const { data, error, reload } = useDriverData(`/api/drivers/me/discover?day=${day}`);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setSaved(Array.isArray(stored) ? stored : []);
    } catch {
      setSaved([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!data) return;
    if (previous.current?.day === data.day) {
      const updated = transportChanges(previous.current.items, data.items);
      if (updated.length) {
        setChanges((old) => [...updated, ...old.filter((next) => !updated.some((i) => i.id === next.id))].slice(0, 8));
      }
    } else {
      setChanges([]);
    }
    previous.current = data;
  }, [data]);

  function toggleSave(id) {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id].slice(-300);
    setSaved(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }

  const selected = data?.items.find((item) => item.id === selectedId);
  const items = (data?.items || []).filter((item) => item.kind === kind && item.direction === direction && item.status !== "completed" && item.status !== "cancelled" && Date.parse(item.actual || item.estimated || item.scheduled) > Date.now());

  const formattedDay = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(new Date());

  return (
    <div className="driver-tab-page discover-page drv-cockpit-page">
      {/* ── En-tête épuré Trafic ── */}
      <div className="driver-tab-title">
        <div>
          <h1>Trafic</h1>
        </div>
        <button className="driver-icon-button" onClick={reload} aria-label="Actualiser les flux">
          <RefreshCw size={20} />
        </button>
      </div>

      {/* ── 2 Choix exclusifs : Aéroport ou Gare ── */}
      <div className="drv-traffic-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={kind === "flight"}
          className={`drv-traffic-tab ${kind === "flight" ? "active" : ""}`}
          onClick={() => setKind("flight")}
        >
          <Plane size={18} />
          <span>Aéroport d'Entzheim</span>
        </button>
        <button
          role="tab"
          aria-selected={kind === "train"}
          className={`drv-traffic-tab ${kind === "train" ? "active" : ""}`}
          onClick={() => setKind("train")}
        >
          <TrainFront size={18} />
          <span>Gare Centrale</span>
        </button>
      </div>

      {/* ── Indicateur du jour en cours (aucun sélecteur de dates) ── */}
      <div className="drv-current-day-badge">
        <Clock size={14} />
        <span>Aujourd'hui · {formattedDay}</span>
      </div>

      {/* ── Arrivées / Départs ── */}
      <div className="drv-direction-segmented">
        <button
          className={`drv-direction-btn ${direction === "arrival" ? "active" : ""}`}
          onClick={() => setDirection("arrival")}
        >
          Arrivées
        </button>
        <button
          className={`drv-direction-btn ${direction === "departure" ? "active" : ""}`}
          onClick={() => setDirection("departure")}
        >
          Départs
        </button>
      </div>

      {/* ── Alertes & changements récents ── */}
      {changes.length > 0 && (
        <div className="discover-changes" role="status">
          <strong>
            <BellRing size={16} /> Ajustements d'horaires récents
          </strong>
          {changes.map((item) => (
            <button key={item.id} onClick={() => setSelectedId(item.id)}>
              {item.number} · {item.city} · {item.statusText}
              {item.estimated ? ` · ${clock(item.estimated)}` : ""}
              {item.platform ? ` · voie ${item.platform}` : ""}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div role="alert" className="driver-notice">
          {error}
          <button className="driver-chip" onClick={reload}>
            Réessayer
          </button>
        </div>
      )}

      {!data && !error && <Loading label="Réception des flux en direct…" />}

      {data && items.length === 0 && (
        <p className="driver-empty-state">
          Aucun flux {direction === "arrival" ? "d'arrivée" : "de départ"} répertorié pour le moment.
        </p>
      )}

      {/* ── Liste des événements en cartes cockpit ── */}
      <div className="discover-events">
        {items.map((item) => (
          <article key={item.id} className="drv-traffic-card">
            <button className="drv-traffic-main" onClick={() => setSelectedId(item.id)}>
              <div className="drv-traffic-icon-box">
                {item.kind === "flight" ? <Plane size={22} /> : <TrainFront size={22} />}
              </div>
              <div className="drv-traffic-info">
                <div className="drv-traffic-header-line">
                  <span className="drv-traffic-time">
                    {clock(item.scheduled)}
                    {item.estimated && item.estimated !== item.scheduled ? (
                      <span className="drv-traffic-delay"> → {clock(item.estimated)}</span>
                    ) : null}
                  </span>
                  <span
                    className={`transport-status ${item.status === "cancelled" ? "cancelled" : item.status === "delayed" ? "delayed" : ""}`}
                  >
                    {item.statusText}
                  </span>
                </div>
                <h3>
                  {item.number} · {item.city || "Strasbourg"}
                </h3>
                <p className="drv-traffic-sub">
                  {item.carrier} {item.platform ? `· Voie ${item.platform}` : ""}{" "}
                  {item.terminal ? `· T${item.terminal}` : ""}
                </p>
              </div>
            </button>
            <button
              className={`drv-bookmark-btn ${saved.includes(item.id) ? "saved" : ""}`}
              onClick={() => toggleSave(item.id)}
              aria-label={saved.includes(item.id) ? "Retirer" : "Enregistrer"}
            >
              <Bookmark size={16} fill={saved.includes(item.id) ? "currentColor" : "none"} />
            </button>
          </article>
        ))}
      </div>

      {/* ── Modal détail ── */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? `${selected.number} · ${selected.city}` : ""}
        maxWidth={560}
      >
        {selected && (
          <dl className="driver-detail-list">
            {[
              [
                "Trajet",
                selected.direction === "arrival" ? `${selected.city} → Strasbourg` : `Strasbourg → ${selected.city}`,
              ],
              ["Heure prévue", clock(selected.scheduled)],
              ["Heure estimée", clock(selected.estimated)],
              ["Statut", selected.statusText],
              ["Transporteur", selected.carrier],
              ["Voie", selected.platform],
              ["Porte", selected.gate],
              ["Terminal", selected.terminal],
              ["Dernière mise à jour", clock(selected.updatedAt)],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
        )}
      </Modal>
    </div>
  );
}

function GoldTraffic() {
  const gold = useDriverGold();
  if (!gold) return <Loading />;
  if (gold.active) return <DiscoverPage />;
  return (
    <div className="driver-tab-page drv-cockpit-page">
      <h1>Trafic</h1>
      <p>Les arrivées en gare et à l’aéroport sont incluses dans StrasDrive Gold.</p>
      <Link href="/driver/private-clients" className="btn btn-primary mt-4">Découvrir SDGold</Link>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/driver/discover")({
  head: () => ({ meta: [{ title: "Trafic · StrasDrive" }] }),
  component: () => (
    <DriverLayout>
      <GoldTraffic />
    </DriverLayout>
  ),
});
