import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Phone, Mail, AlertTriangle, ShieldCheck, UserX, UserCheck, Send, CheckCircle2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { apiFetch } from "@/lib/archive-fetch";
import ChatMedia from "@/components/ride/ChatMedia";
import { useToast } from "@/components/ui/Toast";
import AdminRideMap from "@/components/admin/AdminRideMap";

function EvidencePage() {
  const toast = useToast();
  const [archives, setArchives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [warningTarget, setWarningTarget] = useState("driver");
  const [warningText, setWarningText] = useState("");
  const [showWarningBox, setShowWarningBox] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/chat-evidence");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setArchives(data.archives);
    } catch (err) {
      setError(err.message || "Chargement impossible");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      setSelected((old) => (old && Date.parse(old.expiresAt) <= Date.now() ? null : old));
      load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);

  async function inspect(id) {
    setBusy(true);
    setError("");
    setShowWarningBox(false);
    try {
      const res = await apiFetch(`/api/admin/chat-evidence?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelected(data.evidence);
    } catch (err) {
      setError(err.message || "Échanges indisponibles");
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(action, extra = {}) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/admin/chat-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rideId: selected.rideId,
          driverId: selected.driverId,
          riderId: selected.riderId,
          messageId: selected.reportInfo?.messageId,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(data.message || "Action effectuée", "success");
      await inspect(selected.archiveId);
    } catch (err) {
      toast(err.message || "Erreur lors de l’action", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content-pad" style={{ maxWidth: 960 }}>
      <h1 className="page-title">Gestion des signalements & échanges</h1>
      <p className="page-sub">
        Motifs, contacts passager/chauffeur, avertissements, retrait de signalement et suspension.
      </p>

      {error && (
        <p role="alert" className="mt-3" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {!archives.length && <p className="mt-4">Aucun signalement en cours.</p>}

      <div className="flex-col gap-3 mt-4">
        {archives
          .filter((a) => Date.parse(a.expiresAt) > Date.now())
          .map((a) => (
            <button
              key={a.archiveId}
              type="button"
              className="card card-pad"
              style={{ textAlign: "left", color: "inherit", width: "100%" }}
              disabled={busy}
              onClick={() => inspect(a.archiveId)}
            >
              <strong>Course #{a.rideId.slice(0, 10)}</strong>
              <p className="small mt-1">
                {a.rideCreatedAt
                  ? new Intl.DateTimeFormat("fr-FR", {
                      timeZone: "Europe/Paris",
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(a.rideCreatedAt))
                  : "Date indisponible"}{" "}
                · {a.driverName || "Chauffeur indisponible"}
              </p>
              <p className="small mt-1">
                {a.messageCount} message(s) archivé(s) · Suppression le {new Date(a.expiresAt).toLocaleString("fr-FR")}
              </p>
            </button>
          ))}
      </div>

      {busy && (
        <p role="status" className="mt-3">
          Chargement en cours…
        </p>
      )}

      {selected && (
        <section
          className="card card-pad mt-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {/* Entête */}
          <div className="flex justify-between items-center gap-2 mb-4 wrap">
            <div>
              <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Dossier Course #{selected.rideId.slice(0, 10)}</h2>
              <span className="tiny muted">
                Archivage expiré le {new Date(selected.expiresAt).toLocaleString("fr-FR")}
              </span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>
              Fermer le dossier
            </button>
          </div>

          {/* Motif du signalement */}
          <div
            className="card card-pad mb-4"
            style={{
              background: selected.reportInfo?.isDismissed ? "#052e16" : "#2a1215",
              border: selected.reportInfo?.isDismissed ? "1px solid #16a34a" : "1px solid #dc2626",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              {selected.reportInfo?.isDismissed ? (
                <ShieldCheck size={18} color="#22c55e" />
              ) : (
                <AlertTriangle size={18} color="#ef4444" />
              )}
              <strong style={{ color: selected.reportInfo?.isDismissed ? "#4ade80" : "#f87171" }}>
                {selected.reportInfo?.isDismissed ? "Signalement classé sans suite (injustifié)" : "Signalement actif"}
              </strong>
            </div>
            <p className="small mb-1">
              <strong>Motif :</strong> {selected.reportInfo?.reason || "Non précisé"}
            </p>
            <p className="small">
              <strong>Détails passager :</strong> {selected.reportInfo?.details || "Aucun commentaire supplémentaire."}
            </p>
          </div>

          {/* Récapitulatif Course */}
          {selected.rideData && (
            <div className="card card-pad mb-4" style={{ background: "var(--surface-2)" }}>
              <div className="small">
                <strong>Départ :</strong> {selected.rideData.pickup?.address || "Adresse inconnue"}
              </div>
              <div className="small mt-1">
                <strong>Arrivée :</strong> {selected.rideData.dropoff?.address || "Adresse inconnue"}
              </div>
              <div className="tiny muted mt-2">
                Montant :{" "}
                {(() => {
                  const f = selected.rideData.fare;
                  const total = typeof f === "object" && f !== null ? f.total : f;
                  return total != null ? `${Number(total).toFixed(2)} €` : "N/C";
                })()}{" "}
                · Statut : {selected.rideData.status}
              </div>
              <div className="mt-3">
                <AdminRideMap pickup={selected.rideData.pickup} dropoff={selected.rideData.dropoff} />
              </div>
            </div>
          )}

          {/* Fiches Contact : Passager & Chauffeur */}
          <div className="grid-2 gap-3 mb-4">
            {/* Passager */}
            <div className="card card-pad">
              <strong className="small">Passager</strong>
              <div className="mt-2">{selected.rider?.name || "Passager"}</div>
              <div className="tiny muted">{selected.rider?.email}</div>
              <div className="tiny muted">{selected.rider?.phone || "Pas de numéro"}</div>
              <div className="flex gap-2 mt-3 wrap">
                {selected.rider?.phone && (
                  <a href={`tel:${selected.rider.phone}`} className="btn btn-secondary btn-sm">
                    <Phone size={14} /> Appeler
                  </a>
                )}
                {selected.rider?.email && (
                  <a
                    href={`mailto:${selected.rider.email}?subject=StrasDrive%20-%20Course%20%23${selected.rideId}`}
                    className="btn btn-secondary btn-sm"
                  >
                    <Mail size={14} /> E-mail
                  </a>
                )}
              </div>
            </div>

            {/* Chauffeur */}
            <div className="card card-pad">
              <div className="flex justify-between items-start">
                <strong className="small">Chauffeur</strong>
                <span className={`badge ${selected.driver?.isApproved ? "badge-success" : "badge-danger"}`}>
                  {selected.driver?.isApproved ? "Actif" : "Suspendu"}
                </span>
              </div>
              <div className="mt-2">{selected.driver?.name || "Chauffeur"}</div>
              <div className="tiny muted">{selected.driver?.email}</div>
              <div className="tiny muted">{selected.driver?.phone || "Pas de numéro"}</div>
              {selected.driver?.vehicle && (
                <div className="tiny muted mt-1">
                  {selected.driver.vehicle.make} {selected.driver.vehicle.model} ({selected.driver.vehicle.plate})
                </div>
              )}
              <div
                className="tiny mt-1"
                style={{ color: selected.driver?.reportCount >= 3 ? "var(--danger)" : "var(--text-muted)" }}
              >
                {selected.driver?.reportCount || 0} signalement(s) au compteur
              </div>
              <div className="flex gap-2 mt-3 wrap">
                {selected.driver?.phone && (
                  <a href={`tel:${selected.driver.phone}`} className="btn btn-secondary btn-sm">
                    <Phone size={14} /> Appeler
                  </a>
                )}
                {selected.driver?.email && (
                  <a
                    href={`mailto:${selected.driver.email}?subject=StrasDrive%20-%20Course%20%23${selected.rideId}`}
                    className="btn btn-secondary btn-sm"
                  >
                    <Mail size={14} /> E-mail
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Classement administratif et avertissements */}
          <div className="card card-pad mb-4">
            <h3 className="small mb-2" style={{ margin: 0 }}>
              Classement administratif & Avertissements
            </h3>
            <p className="tiny muted mb-3">
              Attribuez un degré de gravité vérifié. Seules ces décisions comptent dans le compteur d avertissements.
            </p>

            {selected.decision && (
              <div
                className="p-3 mb-3"
                style={{
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  borderLeft: selected.decision.isDismissed
                    ? "4px solid #22c55e"
                    : selected.decision.degree === "critical"
                      ? "4px solid #b91c1c"
                      : selected.decision.degree === "severe"
                        ? "4px solid #ef4444"
                        : selected.decision.degree === "medium"
                          ? "4px solid #f97316"
                          : selected.decision.degree === "mild"
                            ? "4px solid #eab308"
                            : "4px solid #94a3b8",
                }}
              >
                <div className="flex justify-between items-center wrap gap-2">
                  <div>
                    <strong>
                      Décision actuelle :{" "}
                      {selected.decision.isDismissed
                        ? "Classé sans suite"
                        : selected.decision.degree === "very_mild"
                          ? "Très léger (aucun avertissement)"
                          : selected.decision.degree === "mild"
                            ? "Léger (14 jours)"
                            : selected.decision.degree === "medium"
                              ? "Moyen (1 mois)"
                              : selected.decision.degree === "severe"
                                ? "Grave (sans expiration)"
                                : selected.decision.degree === "critical"
                                  ? "Extrêmement grave (suspension immédiate)"
                                  : "Non classé"}
                    </strong>
                    {selected.decision.expiresAt && (
                      <p className="tiny muted mt-1">
                        Expire le : {new Date(selected.decision.expiresAt).toLocaleDateString("fr-FR")}
                      </p>
                    )}
                  </div>
                  <span className="badge badge-neutral">
                    {selected.activeWarningsCount || 0} avertissement(s) actif(s) pour ce chauffeur
                  </span>
                </div>
              </div>
            )}

            {/* Sélecteur de degré */}
            <div className="flex gap-2 wrap mb-3">
              {[
                { id: "very_mild", label: "Très léger", bg: "transparent", border: "var(--border)", color: "inherit" },
                { id: "mild", label: "Léger (14 j)", bg: "#fef08a", border: "#eab308", color: "#854d0e" },
                { id: "medium", label: "Moyen (1 mois)", bg: "#ffedd5", border: "#f97316", color: "#9a3412" },
                { id: "severe", label: "Grave (sans exp.)", bg: "#fee2e2", border: "#ef4444", color: "#991b1b" },
                { id: "critical", label: "Extrêmement grave", bg: "#7f1d1d", border: "#dc2626", color: "#fef2f2" },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: d.bg,
                    border: `1px solid ${d.border}`,
                    color: d.color,
                    fontWeight: 600,
                  }}
                  disabled={busy}
                  onClick={() => {
                    const confirmMsg =
                      d.id === "critical"
                        ? "Attention : un signalement extrêmement grave suspend immédiatement et définitivement le compte chauffeur. Confirmer ?"
                        : `Classer ce signalement comme « ${d.label} » ?`;
                    if (window.confirm(confirmMsg)) {
                      handleAction("classify_report", { degree: d.id, warningText });
                    }
                  }}
                >
                  {d.label}
                </button>
              ))}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Classer ce dossier sans suite (signalement injustifié) ?")) {
                    handleAction("classify_report", { dismiss: true });
                  }
                }}
              >
                Classer sans suite
              </button>
            </div>

            {/* Message d avertissement transmis dans l assistance */}
            <div className="mt-3">
              <label className="tiny muted mb-1" style={{ display: "block" }}>
                Texte explicatif transmis au chauffeur (sans mention du degré interne) :
              </label>
              <textarea
                className="input mb-2"
                rows={2}
                placeholder="Rédigez le rappel des règles qui sera déposé dans la messagerie d assistance du chauffeur…"
                value={warningText}
                onChange={(e) => setWarningText(e.target.value)}
              />
            </div>
          </div>

          {/* Échanges archivés (messages, vocaux, photos) */}
          <h3 className="small mb-3">Échanges durant la course ({selected.messages.length})</h3>
          <div className="flex-col gap-2">
            {selected.messages.map((m, i) => (
              <div key={m.id || i} className="chat-evidence-message">
                <p className="tiny mb-1">
                  <strong>{m.from === "driver" ? "Chauffeur" : "Passager"}</strong> ·{" "}
                  {new Date(m.at).toLocaleString("fr-FR")}
                </p>
                {["audio", "image"].includes(m.type) ? (
                  <ChatMedia key={m.url} message={m} url={m.url} />
                ) : m.type === "location" ? (
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`}
                  >
                    Position partagée : {m.lat}, {m.lng}
                  </a>
                ) : (
                  <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.text}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin/chat-evidence")({head: () => ({ meta: [{"title": "Signalements et échanges · StrasDrive"}, {"name": "description", "content": "Examen administratif des signalements et échanges de courses StrasDrive."}, {"property": "og:title", "content": "Signalements et échanges · StrasDrive"}, {"property": "og:description", "content": "Examen administratif des signalements et échanges de courses StrasDrive."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }),
  component: () => (
    <AdminLayout>
      <EvidencePage />
    </AdminLayout>
  ),
});
