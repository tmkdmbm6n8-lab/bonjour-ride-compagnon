import { useState } from "react";
import { ArrowRight, Heart, QrCode } from "lucide-react";
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

  const trial = !gold.active && !manage && gold.trialAvailable && !gold.unavailable;
  const canOpenBilling = !gold.unavailable && (manage || (!gold.included && !gold.active));

  return (
    <section className="driver-gold-card" aria-labelledby="driver-gold-status">
      <header className="driver-gold-header">
        <div className="driver-gold-meta">
          <span className="driver-gold-eyebrow">Abonnement chauffeur</span>
          {!gold.active && !gold.unavailable && <span className="driver-gold-inactive">Inactif</span>}
        </div>
        <h2 id="driver-gold-status">StrasDrive <span>Gold</span></h2>
      </header>

      {gold.active ? (
        <div className="driver-gold-current">
          <strong>{gold.included ? "Accès inclus" : gold.status === "trialing" ? "Essai en cours" : "Abonnement actif"}</strong>
          <p>{goldPeriodText(gold)}</p>
        </div>
      ) : (
        <>
          <div className="driver-gold-pricing">
            <p className="driver-gold-price"><strong>{monthlyPrice}</strong> <span>TTC par mois</span></p>
            {trial && <p className="driver-gold-trial">{GOLD_TRIAL_DAYS} jours offerts à la première souscription</p>}
          </div>

          <ul className="driver-gold-benefits">
            <li><QrCode size={18} aria-hidden="true" /><span>Invitez vos clients avec votre QR code personnel</span></li>
            <li><Heart size={18} aria-hidden="true" /><span>Apparaissez en tête du comparateur de vos clients privés</span></li>
          </ul>
        </>
      )}

      {canOpenBilling && (
        <button type="button" className="driver-gold-action" onClick={openBilling} disabled={busy}>
          {busy ? "Ouverture de Stripe…" : gold.active ? "Gérer mon abonnement" :
            trial ? "Commencer mon essai gratuit" : "Réactiver StrasDrive Gold"}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
      {trial && <p className="driver-gold-note">Sans carte enregistrée, l’essai se termine sans prélèvement.</p>}
      {waitingForStripe && !gold.active && <p className="driver-gold-note" role="status">Vérification de votre abonnement auprès de Stripe…</p>}
      {gold.unavailable && <p className="driver-gold-note" role="status">Le statut de votre abonnement est temporairement indisponible.</p>}
      {error && <p className="driver-gold-error" role="alert">{error}</p>}
    </section>
  );
}
