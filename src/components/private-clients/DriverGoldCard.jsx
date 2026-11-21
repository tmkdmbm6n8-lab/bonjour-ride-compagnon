import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ArrowRight, ArrowLeft, Plane, QrCode, Percent, Crown, CalendarDays, Check, Gift } from "lucide-react";
import { apiFetch } from "@/lib/archive-fetch";
import { GOLD_MONTHLY_CENTS, GOLD_TRIAL_DAYS } from "@/lib/driver-gold";

export function goldStatusLabel(gold) {
  return gold.status === "trialing" && gold.active ? "StrasDrive Gold — essai gratuit" : gold.included ? "StrasDrive Gold — accès inclus" : gold.active ? "StrasDrive Gold actif" : "Statut StrasDrive Gold inactif";
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris",
});
const euro = (cents) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const goldPlans = [
  { id: "monthly", label: "1 mois", cents: GOLD_MONTHLY_CENTS, months: 1, available: true },
  { id: "halfyear", label: "6 mois", cents: 10500, months: 6, badge: "Meilleur compromis", available: false },
  { id: "yearly", label: "12 mois", cents: 20004, months: 12, badge: "Prix mensuel le plus bas", available: false },
];

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const isIosNative = typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

  if (!gold) return null;
  const manage = gold.canManage;
  const selected = goldPlans[selectedIndex];
  const saving = Math.round((1 - selected.cents / (GOLD_MONTHLY_CENTS * selected.months)) * 100);

  async function openBilling() {
    if (!manage && !selected.available) {
      setError("Cette formule sera disponible après sa configuration et sa vérification dans le système de paiement.");
      return;
    }
    // Never start a Stripe checkout inside native iOS. Apple purchases must be
    // verified by the App Store server before granting a Gold entitlement.
    if (isIosNative) {
      setError(gold.active
        ? "Pour gérer un abonnement Gold existant souscrit sur le Web, ouvrez votre compte StrasDrive depuis un navigateur. Les abonnements Apple ne sont pas encore activés."
        : "Les achats Gold sur iPhone seront disponibles après l’activation et la vérification sécurisée des achats intégrés Apple.");
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
        <h2 id="driver-gold-status">StrasDrive <span>Gold <Crown className="driver-gold-crown" size={27} aria-hidden="true" /></span></h2>
      </header>

      <p>Commission : 15 % sans abonnement, 5 % avec Gold payant, et 0 % pour une course effectuée avec votre propre client privé si votre abonnement est payant et actif.</p>
      {gold.active ? (
        <div className="driver-gold-current">
          <strong>{gold.included ? "Accès inclus" : gold.status === "trialing" ? "Essai en cours" : "Abonnement actif"}</strong>
          <p>{goldPeriodText(gold)}</p>
        </div>
      ) : (
        <>
          <div className="driver-gold-pricing">
            <p className="driver-gold-plan-intro">Choisissez la formule qui vous convient</p>
            <div className="driver-gold-plan-navigation" role="group" aria-label="Choisir une durée d’abonnement">
              <div className="driver-gold-plan-nav-slot">
                {selectedIndex > 0 && <button type="button" className="driver-gold-plan-arrow" aria-label="Formule précédente" onClick={() => { setSelectedIndex((index) => Math.max(0, index - 1)); setError(""); }}><ArrowLeft size={22} aria-hidden="true" /></button>}
              </div>
              <div className={`driver-gold-plan driver-gold-plan-single ${selected.badge ? "featured" : ""}`} aria-live="polite">
                {selected.badge && <span className="driver-gold-plan-badge">{selected.badge}</span>}
                <span className="driver-gold-plan-term"><CalendarDays size={17} aria-hidden="true" />{selected.id === "monthly" ? "Mensuel" : selected.id === "halfyear" ? "6 mois" : "12 mois"}</span>
                <strong className="driver-gold-plan-total">{euro(selected.cents)}</strong>
                <span className="driver-gold-plan-monthly">{selected.months === 1 ? "TTC / mois" : `TTC / ${selected.months} mois`}</span>
                {selected.months > 1 && <span className="driver-gold-plan-saving">soit {euro(Math.round(selected.cents / selected.months))} / mois · Économisez {saving} %</span>}
                <div className="driver-gold-plan-divider" />
                <ul className="driver-gold-plan-features">
                  <li><Check size={16} aria-hidden="true" />Sans engagement</li>
                  <li><Check size={16} aria-hidden="true" />Résiliable à tout moment</li>
                  <li><Check size={16} aria-hidden="true" />{selected.months === 1 ? "Renouvellement automatique" : `Paiement unique (${selected.months} mois)`}</li>
                </ul>
                {canOpenBilling && <button type="button" className="driver-gold-plan-choose" onClick={openBilling} disabled={busy}>
                  {busy ? "Ouverture…" : !manage && !selected.available ? "Bientôt disponible" : isIosNative ? "Achats Apple bientôt disponibles" : manage ? "Gérer mon abonnement" : "Choisir cette formule"} <ArrowRight size={20} aria-hidden="true" />
                </button>}
              </div>
              <div className="driver-gold-plan-nav-slot">
                {selectedIndex < goldPlans.length - 1 && <button type="button" className="driver-gold-plan-arrow" aria-label="Formule suivante" onClick={() => { setSelectedIndex((index) => Math.min(goldPlans.length - 1, index + 1)); setError(""); }}><ArrowRight size={22} aria-hidden="true" /></button>}
              </div>
            </div>
            <div className="driver-gold-plan-dots" role="group" aria-label="Navigation entre les trois formules">
              {goldPlans.map((plan, index) => <button key={plan.id} type="button" className={index === selectedIndex ? "active" : ""} aria-label={`Afficher la formule ${plan.label}`} aria-current={index === selectedIndex ? "step" : undefined} onClick={() => { setSelectedIndex(index); setError(""); }} />)}
            </div>
            <p className="driver-gold-plan-hint">{selected.available ? "Paiement et renouvellement mensuels." : `Paiement de ${euro(selected.cents)} pour ${selected.months} mois, après activation de cette formule.`}</p>
            {trial && selected.available && <p className="driver-gold-trial"><Gift size={19} aria-hidden="true" /> {GOLD_TRIAL_DAYS} jours offerts à la première souscription</p>}
          </div>

          <ul className="driver-gold-benefits">
            <li><Percent size={18} aria-hidden="true" /><div><strong>Jusqu’à 0 % de commission sur vos clients privés</strong><p>0 % uniquement pour les courses avec vos propres clients privés, après un premier paiement vérifié et tant que Gold payant est actif. Pour les autres courses : 5 % avec Gold payant ; pendant l’essai gratuit, le taux normal de 15 % reste applicable.</p></div></li>
            <li><QrCode size={18} aria-hidden="true" /><div><strong>Développez votre propre clientèle privée</strong><p>Partagez votre QR code. Les passagers qui vous choisissent en favori vous retrouvent en tête de leur comparateur.</p></div></li>
            <li><Plane size={18} aria-hidden="true" /><div><strong>Des courses Gold avec un potentiel de retour</strong><p>Les arrivées d’avions et de trains en direct font ressortir les courses qui se terminent à moins de 5 km ou à 5 minutes de la gare ou de l’aéroport au bon moment. Ces courses aller sont réservées à Gold. Le retour dépend des réservations.</p></div></li>
          </ul>
        </>
      )}

      {canOpenBilling && gold.active && (
        <button type="button" className="driver-gold-action" onClick={openBilling} disabled={busy}>
          {busy ? "Ouverture de Stripe…" : !manage && !selected.available ? "Formule bientôt disponible" : isIosNative ? (gold.active ? "Informations sur mon abonnement" : "Achats Apple bientôt disponibles") : gold.active ? "Gérer mon abonnement" :
            trial ? "Commencer mon essai gratuit" : "Réactiver StrasDrive Gold"}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
      {!gold.included && !gold.unavailable && <p className="driver-gold-note">Abonnement sans engagement, résiliable à tout moment depuis la plateforme de souscription. En cas de résiliation, l’accès Gold reste actif jusqu’à la fin de la période payée, sans remboursement automatique de cette période ni nouveau renouvellement. Sous réserve des remboursements accordés par le prestataire de paiement et des droits prévus par la loi.</p>}
      {trial && <p className="driver-gold-note">{isIosNative ? "L’essai Apple sera proposé après activation des achats intégrés." : "Sans carte enregistrée, l’essai se termine sans prélèvement."}</p>}
      {waitingForStripe && !gold.active && <p className="driver-gold-note" role="status">Vérification de votre abonnement auprès de Stripe…</p>}
      {gold.unavailable && <p className="driver-gold-note" role="status">Le statut de votre abonnement est temporairement indisponible.</p>}
      {error && <p className="driver-gold-error" role="alert">{error}</p>}
    </section>
  );
}
