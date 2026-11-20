import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CarFront, ShieldCheck, CheckCircle2, ArrowRight, FileCheck2 } from "lucide-react";
import RiderLayout from "@/components/RiderLayout";
import CloseControl from "@/components/ui/CloseControl";
import Link from "@/lib/archive-navigation";
import { apiFetch } from "@/lib/archive-fetch";

function BecomeDriverPage() {
  const [application, setApplication] = useState(undefined);
  const [canDrive, setCanDrive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let ignore = false;
    apiFetch("/api/users/me/driver-application").then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de vérifier votre candidature.");
      if (!ignore) { setApplication(data.application); setCanDrive(data.canDrive); }
    }).catch((err) => { if (!ignore) { setError(err.message); setApplication(null); } });
    return () => { ignore = true; };
  }, []);
  async function submit() {
    if (busy || application || canDrive) return;
    setBusy(true); setError("");
    try {
      const res = await apiFetch("/api/users/me/driver-application", { method: "POST", body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Envoi impossible");
      setApplication(data.application);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const accepted = application?.status === "accepted" || canDrive;
  return (
    <div className="content-pad sd-become-driver-page">
      <div className="sd-become-driver-header">
        <span className="sd-become-driver-kicker">ESPACE PASSAGER · STRASDRIVE</span>
        <CloseControl href="/profile" label="Fermer et revenir au menu passager" />
      </div>
      <section className="sd-become-driver-panel">
        <div className="sd-become-driver-icon"><CarFront size={34} aria-hidden="true" /></div>
        <h1>Devenez chauffeur <span>StrasDrive</span></h1>
        <p className="sd-become-driver-lead">Développez votre activité VTC tout en conservant votre compte passager.</p>
        <div className="sd-become-driver-features">
          <p><CheckCircle2 size={21} /> Un seul compte pour voyager et conduire</p>
          <p><ShieldCheck size={21} /> Candidature examinée par notre équipe</p>
          <p><FileCheck2 size={21} /> Documents VTC à transmettre après acceptation</p>
        </div>
        {accepted ? (
          <div className="sd-become-driver-status">
            <strong>Candidature acceptée !</strong>
            <p>Complétez votre véhicule et transmettez vos documents. Vous ne pourrez effectuer des courses qu'après leur validation.</p>
            <Link className="sd-become-driver-submit" href="/driver/profile">Compléter mon dossier <ArrowRight size={20} /></Link>
          </div>
        ) : application?.status === "pending" ? (
          <div className="sd-become-driver-status" role="status">
            <strong>Candidature envoyée</strong>
            <p>Votre demande est en attente d'examen par l'administrateur. Vous pouvez continuer à voyager normalement.</p>
          </div>
        ) : application?.status === "rejected" ? (
          <div className="sd-become-driver-status" role="status">
            <strong>Candidature non retenue</strong>
            <p>Votre demande n'a pas été acceptée. Contactez l'assistance si vous souhaitez en discuter.</p>
          </div>
        ) : application === undefined ? <p role="status">Chargement de votre candidature…</p> : (
          <button className="sd-become-driver-submit" type="button" disabled={busy || Boolean(error)} onClick={submit}>
            {busy ? "Envoi en cours…" : "Envoyer ma candidature"} <ArrowRight size={20} />
          </button>
        )}
        {error && <p className="input-error-msg" role="alert">{error}</p>}
        <p className="sd-become-driver-footnote">Aucun changement de votre compte passager avant l'acceptation de votre candidature.</p>
      </section>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/become-driver")({
  component: () => <RiderLayout><BecomeDriverPage /></RiderLayout>,
  head: () => ({ meta: [{ title: "Devenir chauffeur · StrasDrive" }] }),
});
