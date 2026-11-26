import { useDriverGold } from "@/components/DriverLayout";
"use client";
import { useEffect, useState, useRef } from "react";
import useDriverData from "@/hooks/useDriverData";
import Link from "@/lib/archive-navigation";
import {
  PawPrint,
  Banknote,
  HelpCircle,
  Phone,
  Power,
  CheckCircle2,
  FileText,
  ShieldCheck,
  ChevronUp,
  Radio,
} from "lucide-react";
import MapView from "@/components/ArchiveMap";
import Modal from "@/components/ui/Modal";
import { money } from "@/components/ui/bits";
import useGeolocation from "@/hooks/useGeolocation";
import { KovaIcon } from "@/components/brand/KovaLogo";

export default function DriverHome({
  loading,
  online,
  waiting = true,
  busy,
  isConnected,
  needsVehicle,
  position,
  center,
  onToggle,
  acceptsPet,
  togglingPet,
  onTogglePet,
  acceptsCash,
  togglingCash,
  onToggleCash,
  onWaybill,
}) {
  const gold = useDriverGold();
  const { data: earnings } = useDriverData("/api/drivers/me/earnings", 30000);
  const today = earnings?.today;
  const lastRide = earnings?.recentRides?.[0]?.fare?.driverEarnings;
  const [earningsView, setEarningsView] = useState("today"); // "today" | "last"
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Détection du glissement du doigt sans flèche
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Déclenchement uniquement sur glissement horizontal net (> 20px)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
      if (deltaX < 0) {
        // Droite vers la gauche : Recette aujourd'hui
        setEarningsView("today");
      } else {
        // Gauche vers la droite : Dernière course
        setEarningsView("last");
      }
    }
  };

  // Clic ou tap pour basculer facilement
  const handleToggleEarnings = () => {
    setEarningsView((v) => (v === "today" ? "last" : "today"));
  };

  const [helpOpen, setHelpOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const availabilityTouch = useRef(0);
  useEffect(() => { if (!statusOpen) return; const close = e => { if (e.key === "Escape") setStatusOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [statusOpen]);
  useEffect(() => {
    if (!online || !waiting) setStatusOpen(false);
  }, [online, waiting]);
  const [sosOpen, setSosOpen] = useState(false);
  const { position: localPosition } = useGeolocation({ watch: online, maxAge: online ? 0 : undefined });
  const mapCenter = position || localPosition || center;


  return (
    <div className={`drv-cockpit-root ${online ? "is-online" : ""}`}>
      <style>{`
        .drv-online-status.sd-online-signature { position: relative; isolation: isolate; overflow: hidden; border-radius: 12px; justify-content: flex-start; gap: 12px; box-shadow: none; animation: none; }
        @media (max-width: 900px) {
          .shell-driver:has(.drv-cockpit-bottom-bar > .sd-online-signature) > .sidebar { border-top: 0 !important; backdrop-filter: none; -webkit-backdrop-filter: none; }
          .drv-cockpit-bottom-bar:has(> .sd-online-signature) { bottom: calc(var(--shell-nav-height, calc(84px + env(safe-area-inset-bottom, 0px))) - 2px); left: 0; right: 0; gap: 0; }
          .drv-cockpit-bottom-bar > .drv-online-status.sd-online-signature { width: 100%; max-width: none; margin: 0; border: 0; border-radius: 0; background: #0c0d12; box-shadow: none; padding-inline: max(20px, env(safe-area-inset-left, 0px)) max(20px, env(safe-area-inset-right, 0px)); }
        }
        .drv-online-status.sd-online-signature::before { content: none; animation: none; }
        .drv-online-status.sd-online-signature::after { content: ""; position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: linear-gradient(110deg, transparent 10%, color-mix(in srgb, var(--gold-500, #eab308) 10%, transparent) 50%, transparent 90%); pointer-events: none; opacity: 0; animation: sdSignatureEdge 8s linear infinite; }
        .sd-online-signature .sd-signature-dot { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: var(--gold-500, #eab308); color: var(--gold-500, #eab308); animation: sdSignatureDot 6s ease-in-out infinite; }
        .sd-online-signature .drv-online-copy { flex: 1; text-align: left; }
        .sd-online-signature .drv-online-copy strong { font-weight: 550; font-size: 14px; }
        .sd-online-signature .drv-online-copy small { font-size: 11px; }
        @keyframes sdSignatureEdge { 0% { transform: translateX(-110%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(110%); opacity: 0; } }
        @keyframes sdSignatureDot { 0%,100% { opacity: .65; } 50% { opacity: 1; box-shadow: 0 0 8px color-mix(in srgb, currentColor 27%, transparent); } }
        @media (prefers-reduced-motion: reduce) { .drv-online-status.sd-online-signature::after, .sd-online-signature .sd-signature-dot { animation: none !important; } }

        /* Signature availability sheet: same surface and typography as the online strip. */
        .modal-portal-root .drv-online-sheet { background: #0c0d12 !important; border: 0 !important; box-shadow: none !important; color: #f1f7f5; border-radius: 12px 12px 0 0; }
        .modal-portal-root .drv-online-sheet .modal-header { border: 0; box-shadow: none; padding: 16px 20px; }
        .modal-portal-root .drv-online-sheet .modal-header h3 { font-size: 14px !important; font-weight: 550; color: #f1f7f5; }
        .modal-portal-root .drv-online-sheet .modal-body { min-height: 0; overflow-y: auto; gap: 16px; }
        .modal-portal-root .drv-online-sheet .drv-online-sheet-waiting { padding: 12px 0 16px; }
        .modal-portal-root .drv-online-sheet .drv-online-sheet-waiting .sd-signature-dot { display: block; width: 7px; height: 7px; border-radius: 50%; background: currentColor; color: #f1f7f5; margin: 0 auto 16px; animation: sdSignatureDot 6s ease-in-out infinite; }
        .modal-portal-root .drv-online-sheet .drv-online-sheet-waiting h4 { font-size: 15px; font-weight: 550; color: #f1f7f5; }
        .modal-portal-root .drv-online-sheet .drv-online-sheet-waiting p { color: #94a3b8; font-size: 12px; line-height: 1.6; max-width: 320px; margin-inline: auto; }
        @media (max-width: 900px) {
          .modal-portal-root .drv-online-sheet { width: 100%; max-width: 100% !important; border-radius: 0 !important; }
        }
        @media (prefers-reduced-motion: reduce) { .modal-portal-root .drv-online-sheet .sd-signature-dot { animation: none !important; } }

        .drv-cockpit-bottom-bar:has(> .sd-online-signature) { flex-direction: column; background: #0c0d12; pointer-events: auto; }
        .sd-availability-panel { width: 100%; display: grid; grid-template-rows: 0fr; transition: grid-template-rows 450ms cubic-bezier(.22,.61,.36,1); background: #0c0d12; }
        .sd-availability-content { min-height: 0; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; }
        .sd-availability-open .sd-availability-panel { grid-template-rows: 1fr; }
        .sd-availability-content .drv-online-sheet-waiting { margin: 0; padding: 24px 24px 0; }
        .sd-availability-content .drv-online-sheet-waiting p { max-width: 320px; margin-inline: auto; color: #94a3b8; font-size: 12px; }
        .sd-availability-content .drv-online-sheet-waiting h4 { font-size: 15px; font-weight: 550; color: #f1f7f5; }
        .sd-availability-content .sd-signature-dot { display: block; width: 7px; height: 7px; border-radius: 50%; background: var(--gold-500, #eab308); color: var(--gold-500, #eab308); margin: 0 auto 16px; animation: sdSignatureDot 6s ease-in-out infinite; }
        .sd-availability-content .drv-online-stop { margin: 0 auto 32px; }
        .sd-availability-chevron { transition: transform 450ms ease; }
        .sd-availability-open .sd-availability-chevron { transform: rotate(180deg); }
        @media (max-width: 900px) {
          .sd-availability-content { height: max(0px, calc(50dvh - var(--shell-nav-height, 84px) - 72px)); }
          .sd-availability-panel:not(:has(.drv-online-stop)) { display: none; }
          .sd-availability-panel { grid-template-rows: 0fr; }
          .sd-availability-content { height: auto; }
          .sd-availability-content::before { content: ""; flex: 1 0 0; }
          .sd-availability-content::after { content: ""; flex: 1 0 0; }
          .sd-availability-panel { max-height: 0; overflow: hidden; transition: max-height 450ms cubic-bezier(.22,.61,.36,1), grid-template-rows 450ms cubic-bezier(.22,.61,.36,1); }
          .sd-availability-open .sd-availability-panel { max-height: max(0px, calc(50dvh - var(--shell-nav-height, 84px) - 72px)); }
          .sd-availability-content { min-height: 0; height: max(0px, calc(50dvh - var(--shell-nav-height, 84px) - 72px)); }
        }
        @media (prefers-reduced-motion: reduce) { .sd-availability-panel, .sd-availability-chevron { transition: none !important; } .sd-availability-content .sd-signature-dot { animation: none !important; } }
        .drv-go-btn.sd-go-dynamic { position: relative; top: -8px; isolation: isolate; overflow: visible; animation: none; }
        .sd-go-dynamic .drv-go-text { position: relative; z-index: 2; }
        .sd-go-beacon { position: absolute; inset: 0; pointer-events: none; border-radius: inherit; z-index: 1; }
        .sd-go-beacon i { position: absolute; inset: -9px; border: 2px solid currentColor; border-radius: inherit; opacity: 0; animation: sdGoSonar 8s linear infinite; }
        .sd-go-beacon i:nth-child(2) { animation-delay: 4s; }
        .sd-go-connecting .sd-go-beacon i { animation: none; opacity: 0; }
        .drv-go-btn.drv-online-stop { width: 72px; min-width: 72px; max-width: 72px; height: 72px; min-height: 72px; padding: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-inline: auto; flex: 0 0 72px; }
        .drv-go-btn.drv-online-stop { position: relative; overflow: visible; animation: none; }
        .drv-go-btn.drv-online-stop::after { content: ""; position: absolute; inset: -8px; border-radius: 50%; border: 3px solid currentColor; border-left-color: transparent; border-right-color: transparent; pointer-events: none; animation: sdOfflineOrbit 8s ease-in-out infinite; }
        .drv-go-btn.drv-online-stop:disabled::after { animation-play-state: paused; }
        @keyframes sdOfflineOrbit { 0%,100% { transform: rotate(-60deg); } 50% { transform: rotate(120deg); } }
        @media (prefers-reduced-motion: reduce) { .drv-go-btn.drv-online-stop::after { animation: none !important; } }
        @keyframes sdGoSonar { 0% { transform: scale(.85); opacity: 0; } 20% { opacity: .8; } 100% { transform: scale(1.45); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .drv-go-btn.sd-go-dynamic, .sd-go-beacon i { animation: none !important; } .sd-go-beacon i { opacity: 0; } }
      `}</style>
      {/* ── Carte plein écran ── */}
      <div className="drv-cockpit-map">
        <MapView
          viewCacheKey="driver-home"
          center={mapCenter}
          zoom={14}
          userPosition={(online ? localPosition || position : position || localPosition) || undefined}
          navigationMode={online}
          followPosition={online && position ? position : undefined}
        />
      </div>

      <section className="driver-desktop-overview" aria-label="Tableau de bord chauffeur">
        <div className="driver-desktop-heading">
          <span>ESPACE CHAUFFEUR</span>
          <h1>Bonjour, bienvenue</h1>
          <p>Retrouvez vos informations et gérez votre activité depuis votre ordinateur.</p>
        </div>
        <div className="driver-desktop-status">
          <span className={`driver-desktop-status-dot ${online ? "is-online" : ""}`} />
          <div><small>Statut actuel</small><strong>{online ? "En ligne" : "Hors ligne"}</strong></div>
          {online && <button type="button" onClick={onToggle} disabled={busy || loading}>Passer hors ligne</button>}
        </div>
        <Link className="driver-desktop-earnings" href="/driver/earnings">
          <span>Gains aujourd’hui</span>
          <strong>{today ? money(today.earnings) : "—"}</strong>
          <small>Voir mes revenus <span aria-hidden="true">→</span></small>
        </Link>
        <div className="driver-desktop-quick-links">
          <Link href="/driver/discover"><strong>Trafic</strong><span>Aéroport et gare</span></Link>
          <Link href="/driver/inbox"><strong>Messages</strong><span>Contacter l’équipe</span></Link>
          <Link href="/driver/menu"><strong>Mon espace</strong><span>Documents et préférences</span></Link>
        </div>
        <div className="driver-desktop-assistance">
          <button type="button" onClick={() => setHelpOpen(true)}><HelpCircle size={17} /> Aide</button>
          <button type="button" onClick={() => setSosOpen(true)}><ShieldCheck size={17} /> Urgences</button>
        </div>
      </section>

      {/* ── Bandeau supérieur ultra-fin ── */}
      <div className="drv-cockpit-hud">
      <header className="drv-cockpit-island">
        <div className="drv-island-left">
          <KovaIcon size={24} />
          <div className="drv-island-brand">
            <strong className="drv-island-brand-name">StrasDrive {gold?.active && <span className="drv-island-gold">Gold</span>}</strong>
            <span className={`drv-island-badge ${online ? "active" : ""}`}>
              <i /> {online ? "EN LIGNE" : "HORS LIGNE"}
            </span>
          </div>
        </div>

        {/* ── Boutons d'actions rapides (Patte, Espèces, Outil, Aide) ── */}
        <div className="drv-island-actions">
          {/* 1. Bouton Patte de chien (StrasDrive Pet ON / OFF) */}
          <button
            className={`drv-island-btn ${acceptsPet ? "is-active" : ""}`}
            onClick={onTogglePet}
            disabled={togglingPet}
            title={acceptsPet ? "StrasDrive Pet activé" : "Activer StrasDrive Pet"}
            aria-label="StrasDrive Pet"
          >
            <PawPrint size={18} />
          </button>

          {/* 2. Bouton Espèces (Cash ON / OFF à la place de la loupe) */}
          <button
            className={`drv-island-btn ${acceptsCash ? "is-active" : ""}`}
            onClick={onToggleCash}
            disabled={togglingCash}
            title={acceptsCash ? "Courses en espèces acceptées" : "Espèces désactivées"}
            aria-label="Espèces"
          >
            <Banknote size={18} />
          </button>

          <button
            type="button"
            className="drv-island-btn drv-sos-btn"
            onClick={() => setSosOpen(true)}
            title="SOS — numéros d’urgence"
            aria-label="SOS — numéros d’urgence"
          >
            SOS
          </button>

          {/* 4. Bouton Point d'interrogation (FAQ & Questions/Réponses) */}
          <button
            className="drv-island-btn"
            onClick={() => setHelpOpen(true)}
            title="Aide & Questions / Réponses"
            aria-label="Aide"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </header>

      {/* ── Gains du jour / Dernière course avec geste fluide au doigt ── */}
      <div
        className="drv-floating-earnings"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleToggleEarnings}
        role="button"
        tabIndex={0}
        aria-label="Basculer entre la recette du jour et la dernière course"
      >
        <div key={earningsView} className="drv-float-content">
          <span className="drv-float-label">{earningsView === "today" ? "Aujourd'hui" : "Dernière course"}</span>
          <strong className="drv-float-val">
            {earningsView === "today"
              ? today
                ? money(today.earnings)
                : earnings ? "0,00 €" : "—"
              : lastRide != null
                ? money(lastRide)
                : earnings ? "0,00 €" : "—"}
          </strong>
        </div>
      </div>

      </div>

      {/* ── Bouton GO compact flottant en bas ── */}
      <div className={`drv-cockpit-bottom-bar ${statusOpen && online && waiting && !loading && !needsVehicle ? "sd-availability-open" : ""}`}>
        {loading ? (
          <div className="drv-status-loading" role="status">Vérification du statut…</div>
        ) : needsVehicle ? (
          <Link href="/driver/profile" className="drv-go-btn vehicle-needed">
            <span>Véhicule requis</span>
          </Link>
        ) : online ? (
          <button
            type="button"
            className={`drv-online-status sd-online-signature ${waiting ? "is-searching" : ""}`}
            onClick={() => waiting && setStatusOpen(v => !v)}
            onTouchStart={e => { availabilityTouch.current = e.touches[0].clientY; }}
            onTouchEnd={e => { const dy = e.changedTouches[0].clientY - availabilityTouch.current; if (waiting && Math.abs(dy) > 45) { e.preventDefault(); setStatusOpen(dy < 0); } }}
            aria-controls="sd-availability-panel"
            aria-expanded={statusOpen}
          >
            <span className="sd-signature-dot" aria-hidden="true" />
            <span className="drv-online-copy"><strong>Vous êtes en ligne</strong><small>{waiting ? "En attente d’une course" : "Une course vous est proposée"}</small></span>
            <ChevronUp size={20} className="sd-availability-chevron" aria-hidden="true" />
          </button>
        ) : (
          <button
            className={`drv-go-btn is-offline sd-go-dynamic ${busy ? "sd-go-connecting" : ""}`}
            onClick={onToggle}
            disabled={busy || loading}
            aria-label={busy ? "Connexion en cours" : "Passer en ligne"}
            aria-busy={busy}
          >
            <span className="sd-go-beacon" aria-hidden="true"><i /><i /></span>
            <span className="drv-go-text">{busy ? "…" : "GO"}</span>
          </button>
        )}
        {online && waiting && !loading && !needsVehicle && (
          <div id="sd-availability-panel" className="sd-availability-panel" inert={!statusOpen} aria-hidden={!statusOpen}>
            <div className="sd-availability-content">
        <div className="drv-online-sheet-waiting">
          <span className="sd-signature-dot" aria-hidden="true" />
          <h4>Prêt pour votre prochaine course</h4>
          <p>Vous recevrez les nouvelles demandes ici. Vos clients privés peuvent voir votre position approximative tant que vous êtes en ligne.</p>
        </div>
        <button type="button" className="drv-go-btn is-online drv-online-stop" onClick={onToggle} disabled={busy || loading} aria-label={busy ? "Déconnexion en cours" : "Passer hors ligne"} aria-busy={busy} title="Passer hors ligne">
          <Power size={32} aria-hidden="true" />
        </button>
            </div>
          </div>
        )}
      </div>



      <Modal open={sosOpen} onClose={() => setSosOpen(false)} title="SOS — Urgences en France" portal keyboardSafe sheetOnMobile={false}>
        <p className="drv-sos-intro">StrasDrive ne contacte pas les secours à votre place. Pour votre sécurité, arrêtez-vous dès que possible dans un endroit sûr.</p>
        <div className="drv-sos-list">
          {[
            ["SAMU", "Urgence médicale", "15"],
            ["Police / Gendarmerie", "Danger, agression, accident", "17"],
            ["Sapeurs-pompiers", "Incendie, accident, secours", "18"],
            ["Urgences européennes", "Tous types d’urgence", "112"],
            ["Urgence par SMS", "Personnes sourdes, malentendantes ou ne pouvant pas parler", "114", "sms"],
            ["Enfance en danger", "Enfant en danger ou en risque de l’être", "119"],
            ["Prévention du suicide", "Détresse psychologique", "3114"],
          ].map(([name, description, number, scheme = "tel"]) => (
            <a key={number} className="drv-sos-row" href={`${scheme}:${number}`} aria-label={`${name} : ${number}${scheme === "sms" ? " par SMS" : ""}`}>
              <span className="drv-sos-service"><strong>{name}</strong><small>{description}</small></span>
              <span className="drv-sos-number">{number}{scheme === "sms" && <small>SMS</small>}</span>
            </a>
          ))}
        </div>
      </Modal>

      {/* ── Modal Aide & Questions/Réponses ── */}
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Assistance Chauffeur & FAQ">
        <div className="drv-faq-list">
          <div className="drv-faq-item">
            <h4>Comment fonctionne l'attribution des courses ?</h4>
            <p>
              Les courses sont proposées en priorité aux chauffeurs les plus proches du point de prise en charge avec un
              temps d'acceptation dédié.
            </p>
          </div>
          <div className="drv-faq-item">
            <h4>Puis-je refuser les paiements en espèces ?</h4>
            <p>
              Oui, utilisez le bouton Billet en haut à droite pour désactiver ou réactiver les courses en espèces à tout
              moment.
            </p>
          </div>
          <div className="drv-faq-item">
            <h4>Où trouver ma feuille de route ?</h4>
            <p>
              Dès qu'une course est acceptée, le bouton "Feuille de route" s'affiche directement sur votre écran de
              navigation pour justification légale immédiate.
            </p>
          </div>
          <div className="drv-faq-item">
            <h4>Quand sont versés mes gains ?</h4>
            <p>Les virements automatiques sont émis chaque lundi à minuit directement sur votre compte bancaire.</p>
          </div>
          <div className="mt-4 flex gap-2">
            <Link href="/driver/inbox" className="btn btn-secondary flex-1" onClick={() => setHelpOpen(false)}>
              Contacter le support
            </Link>
            <button className="btn btn-primary flex-1" onClick={() => setHelpOpen(false)}>
              Compris
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
