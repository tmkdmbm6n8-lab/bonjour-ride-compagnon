import { useState } from "react";
import { apiFetch } from "@/lib/archive-fetch";
import { GOLD_MONTHLY_CENTS, GOLD_TRIAL_DAYS } from "@/lib/driver-gold";

export function goldStatusLabel(gold) {
  return gold.active ? "StrasDrive Gold actif" : "Statut StrasDrive Gold inactif";
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris",
});
const monthlyPrice = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
  .format(GOLD_MONTHLY_CENTS / 100);

export function goldPeriodText(gold) {
  if (gold.included) return "Inclus avec votre statut de chauffeur prioritaire.";
  if (!gold.active || !gold.endsAt) return null;
  const label = gold.status === "trialing" ? "Fin de l’essai" :
    gold.cancelAtPeriodEnd ? "Fin de l’accès" : "Prochain renouvellement";
  return `${label} le ${dateFormat.format(new Date(gold.endsAt))} (heure de Paris).`;
}

export default function DriverGoldCard({ gold, waitingForStripe }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!gold) return null;
  const manage = gold.canManage;

  async function openBilling() {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/drivers/me/gold", {
        method: "POST",
        body: JSON.stringify({ manage }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "La facturation est indisponible.");
      window.location.assign(result.url);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad driver-notice" aria-labelledby="driver-gold-status">
      <h2 id="driver-gold-status">{goldStatusLabel(gold)}</h2>
      {gold.active ? (
        <p className="small mt-2">{goldPeriodText(gold)}</p>
      ) : (
        <div className="small mt-2">
          <p>Invitez vos clients par QR code et apparaissez en tête de leur comparateur lorsqu’ils préparent une course.</p>
          <p className="mt-2">
            {gold.trialAvailable && !gold.unavailable ? `${GOLD_TRIAL_DAYS} jours d’essai gratuit à la première souscription, puis ` : ""}
            {monthlyPrice} TTC par mois.
          </p>
          {gold.trialAvailable && !gold.unavailable && <p>Sans carte enregistrée, l’accès prend fin à l’expiration de l’essai.</p>}
        </div>
      )}
      {!gold.unavailable && (manage || (!gold.included && !gold.active)) && (
        <button type="button" className="btn btn-primary mt-4" onClick={openBilling} disabled={busy}>
          {busy ? "Ouverture de Stripe…" : gold.active ? "Gérer mon abonnement" :
            gold.trialAvailable && !manage ? "Commencer mon essai" : "Réactiver StrasDrive Gold"}
        </button>
      )}
      {waitingForStripe && !gold.active && <p className="small mt-2" role="status">Vérification de votre abonnement auprès de Stripe…</p>}
      {gold.unavailable && <p className="small mt-2" role="status">Le statut de votre abonnement est temporairement indisponible.</p>}
      {error && <p className="small mt-2" role="alert">{error}</p>}
    </section>
  );
}
