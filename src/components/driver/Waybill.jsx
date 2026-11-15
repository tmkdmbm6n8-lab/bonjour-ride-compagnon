"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { apiFetch } from "@/lib/archive-fetch";
import { waybillRows, waybillHtml } from "@/lib/vtc-waybill";

export default function Waybill({ open, onClose }) {
  const [data, setData] = useState(null);
  const [operator, setOperator] = useState({ legalName: "", address: "", phone: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    setData(null);
    setError("");
    apiFetch("/api/drivers/me/waybill")
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Impossible de charger le justificatif");
        if (!ignore) {
          setData(result);
          setOperator(result.operator);
        }
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [open, revision]);
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/drivers/me/operator", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Enregistrement impossible");
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([waybillHtml(data.document)], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `reservation-${data.document.reference}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Modal open={open} onClose={onClose} title="Réservation préalable · Waybill" maxWidth={680}>
      {error && (
        <p role="alert" className="waybill-warning">
          {error}
          <button className="btn btn-secondary btn-sm" onClick={() => setRevision((n) => n + 1)}>
            Réessayer
          </button>
        </p>
      )}
      {!data && !error && <p>Chargement du justificatif…</p>}
      {data && (
        <>
          {!data.document && (
            <p className="mb-4">
              Aucune réservation attribuée pour le moment. Le justificatif sera disponible dès l’acceptation d’une
              course.
            </p>
          )}
          {data.document && (
            <div className="waybill-sheet">
              <h3>Justificatif de réservation préalable</h3>
              {data.document.isTest && (
                <p className="waybill-warning">Course fictive : ce document ne constitue pas une réservation réelle.</p>
              )}
              {!!data.document.missing.length && (
                <div className="waybill-warning">
                  <strong>Justificatif incomplet</strong>
                  <p>À compléter avant utilisation lors d’un contrôle :</p>
                  <ul>
                    {data.document.missing.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}
              <dl>
                {waybillRows(data.document).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "Non renseigné"}</dd>
                  </div>
                ))}
              </dl>
              <button
                className="btn btn-primary mt-4"
                disabled={data.document.missing.length > 0 || data.document.isTest}
                onClick={download}
              >
                Télécharger le justificatif
              </button>
            </div>
          )}
          <details className="waybill-operator" open={!operator.legalName || !operator.address || !operator.phone}>
            <summary>Informations de l’exploitant VTC</summary>
            <p className="small muted mt-2">
              Indiquez l’entreprise qui réalise le transport. Les numéros SIREN et REVTC proviennent de vos documents
              professionnels approuvés.
            </p>
            <form onSubmit={save} className="flex-col gap-3 mt-3">
              <label>
                Nom ou raison sociale
                <input
                  className="input"
                  value={operator.legalName}
                  maxLength={180}
                  required
                  onChange={(e) => setOperator({ ...operator, legalName: e.target.value })}
                />
              </label>
              <label>
                Adresse de l’exploitant
                <input
                  className="input"
                  value={operator.address}
                  maxLength={400}
                  required
                  onChange={(e) => setOperator({ ...operator, address: e.target.value })}
                />
              </label>
              <label>
                Téléphone de l’exploitant
                <input
                  className="input"
                  type="tel"
                  value={operator.phone}
                  maxLength={40}
                  required
                  onChange={(e) => setOperator({ ...operator, phone: e.target.value })}
                />
              </label>
              <button className="btn btn-secondary" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </form>
          </details>
          <p className="tiny muted mt-4">
            Horaires de Paris. Réservation immédiate enregistrée lors de la commande.{" "}
            <a
              href="https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000052153214"
              target="_blank"
              rel="noreferrer"
            >
              Arrêté du 6 août 2025
            </a>
            .
          </p>
        </>
      )}
    </Modal>
  );
}
