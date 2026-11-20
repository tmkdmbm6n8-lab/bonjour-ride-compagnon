import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ArrowRight, Plane, QrCode, Percent } from "lucide-react";
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
  const isIosNative = typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

  if (!gold) return null;
  const manage = gold.canManage;

  async function openBilling() {
    // Never start a Stripe checkout inside native iOS. Apple purchases must be
    // verified by the App Store server before granting a Gold entitlement.
    if (isIosNative) {
      if (gold.active && gold.canManage) {
        window.location.assign("https://apps.apple.com/account/subscriptions");
      } else {
        setError("Les achats Gold sur iPhone seront disponibles après l’activation et la vérification sécurisée des achats intégrés Apple.");
      }
      return;
    }
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
            <li><Percent size={18} aria-hidden="true" /><div><strong>0 % de commission plateforme</strong><p>À partir du premier paiement et tant que l’abonnement payant est actif. Pendant l’essai, la commission reste de 5 %.</p></div></li>
            <li><QrCode size={18} aria-hidden="true" /><div><strong>Développez votre propre clientèle privée</strong><p>Partagez votre QR code. Les passagers qui vous choisissent en favori vous retrouvent en tête de leur comparateur.</p></div></li>
            <li><Plane size={18} aria-hidden="true" /><div><strong>Des courses Gold avec un potentiel de retour</strong><p>Les arrivées d’avions et de trains en direct font ressortir les courses qui se terminent à moins de 5 km ou à 5 minutes de la gare ou de l’aéroport au bon moment. Ces courses aller sont réservées à Gold. Le retour dépend des réservations.</p></div></li>
          </ul>
        </>
      )}

      {canOpenBilling && (
        <button type="button" className="driver-gold-action" onClick={openBilling} disabled={busy}>
          {busy ? "Ouverture de Stripe…" : isIosNative ? (gold.active ? "Gérer mon abonnement Apple" : "Achats Apple bientôt disponibles") : gold.active ? "Gérer mon abonnement" :
            trial ? "Commencer mon essai gratuit" : "Réactiver StrasDrive Gold"}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
      {trial && <p className="driver-gold-note">{isIosNative ? "L’essai Apple sera proposé après activation des achats intégrés." : "Sans carte enregistrée, l’essai se termine sans prélèvement."}</p>}
      {waitingForStripe && !gold.active && <p className="driver-gold-note" role="status">Vérification de votre abonnement auprès de Stripe…</p>}
      {gold.unavailable && <p className="driver-gold-note" role="status">Le statut de votre abonnement est temporairement indisponible.</p>}
      {error && <p className="driver-gold-error" role="alert">{error}</p>}
    </section>
  );
}
