import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Radar, Siren, Trash2, CheckCircle2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { apiFetch as fetch } from "@/lib/archive-fetch";
import { Loading, Empty } from "@/components/ui/bits";
import { useToast } from "@/components/ui/Toast";
import { formatRelativeTime } from "@/lib/utils/geo";
import { RADAR_VALIDATIONS } from "@/lib/vtc-road-alerts";

function AdminAlertsPage() {
  const toast = useToast();
  const [alerts, setAlerts] = useState(null);
  const [filter, setFilter] = useState("radar");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/road-alerts");
      const data = await res.json();
      setAlerts(res.ok ? data.alerts : []);
    } catch {
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id, action) {
    if (action === "delete" && !window.confirm("Supprimer ce signalement ?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/road-alerts/${id}${action === "validate" ? "/validate" : ""}`, {
        method: action === "validate" ? "POST" : "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Action impossible");
      toast(action === "validate" ? "Radar validé définitivement" : "Signalement supprimé", "success");
      await load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  const list = (alerts || []).filter((a) => a.kind === filter);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Signalements</h1>
          <p className="page-subtitle">
            Radars et contrôles signalés par les chauffeurs. Un radar devient définitif après {RADAR_VALIDATIONS}{" "}
            confirmations ou votre validation.
          </p>
        </div>
      </div>

      <div className="flex gap-2" style={{ marginBottom: 16 }}>
        <button className={`btn btn-sm ${filter === "radar" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter("radar")}>
          <Radar size={15} /> Radars
        </button>
        <button className={`btn btn-sm ${filter === "police" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter("police")}>
          <Siren size={15} /> Police
        </button>
      </div>

      {alerts === null ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty title="Aucun signalement" />
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Statut</th>
                <th>Confirmations</th>
                <th>Signalé</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=18/${a.lat}/${a.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mono-nums"
                    >
                      {a.lat.toFixed(5)}, {a.lng.toFixed(5)}
                    </a>
                  </td>
                  <td>
                    {a.permanent ? (
                      <span className="badge badge-gold">{a.validatedByAdmin ? "Validé (admin)" : "Définitif"}</span>
                    ) : a.active ? (
                      <span className="badge badge-info">En attente</span>
                    ) : (
                      <span className="badge badge-neutral">Expiré</span>
                    )}
                  </td>
                  <td className="mono-nums">
                    {a.confirmations}
                    {a.kind === "radar" && !a.permanent ? ` / ${RADAR_VALIDATIONS}` : ""}
                    {a.denials ? ` · ${a.denials} « plus là »` : ""}
                  </td>
                  <td>{formatRelativeTime(a.createdAt)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {a.kind === "radar" && !a.permanent && (
                      <button className="btn btn-secondary btn-sm" disabled={busyId === a.id} onClick={() => act(a.id, "validate")}>
                        <CheckCircle2 size={14} /> Valider
                      </button>
                    )}{" "}
                    <button className="btn btn-danger btn-sm" disabled={busyId === a.id} onClick={() => act(a.id, "delete")}>
                      <Trash2 size={14} /> Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin/alerts")({
  head: () => ({
    meta: [
      { title: "Signalements · StrasDrive" },
      { name: "description", content: "StrasDrive — radars et contrôles signalés par les chauffeurs." },
      { property: "og:title", content: "Signalements · StrasDrive" },
      { property: "og:description", content: "StrasDrive — radars et contrôles signalés par les chauffeurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AdminLayout>
      <AdminAlertsPage />
    </AdminLayout>
  ),
});
