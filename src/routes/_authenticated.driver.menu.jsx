
import DriverGoldCard from "@/components/private-clients/DriverGoldCard";
import DriverProfileOverview from "@/components/driver/DriverProfileOverview";
import AccountModeSwitch from '@/components/shell/AccountModeSwitch';
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ShieldCheck,
  Crown,
  SlidersHorizontal,
  Car,
  FileText,
  CreditCard,
  ChevronRight,
  Star,
  ArrowUpRight,
  HelpCircle,
  FileCheck,
  LogOut,
} from "lucide-react";
import DriverLayout from "@/components/DriverLayout";
import Link, { useSearchParams } from "@/lib/archive-navigation";
import { signOut, useSession } from "@/lib/archive-auth";
import useDriverData from "@/hooks/useDriverData";
import { Avatar } from "@/components/ui/bits";
import Modal from "@/components/ui/Modal";
import Waybill from "@/components/driver/Waybill";

function DriverMenuPage() {
  const { data: session } = useSession();
  const { data } = useDriverData("/api/users/me?view=driver", 0);
  const { data: driverData } = useDriverData("/api/drivers/me", 0);
  const goldReturn = useSearchParams().get("gold");
  const waitingForStripe = goldReturn === "return";
  const { data: goldData, error: goldError, reload: reloadGold } =
    useDriverData("/api/drivers/me/gold", waitingForStripe ? 5000 : 15000);
  const [goldOpen, setGoldOpen] = useState(null);
  const [panel, setPanel] = useState(null);
  const [waybill, setWaybill] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);

  const user = data?.user || session?.user || {};
  const driver = driverData?.driver;

  return (
    <div className="driver-tab-page drv-cockpit-page">
      {/* ── Carte Chauffeur Pro ── */}
      <button type="button" className="drv-hero-card driver-profile-open" onClick={() => setOverviewOpen(true)} aria-label="Ouvrir mon profil chauffeur et mes distinctions">
        <Avatar name={user.name || ""} src={user.avatar || ""} size="lg" />
        <div className="drv-hero-info">
          <h1>{user.name || "Chauffeur StrasDrive"}</h1>
          <p className="drv-hero-vehicle">
            {driver?.vehicle
              ? `${driver.vehicle.make} ${driver.vehicle.model} · ${driver.vehicle.plate}`
              : "Véhicule en cours"}
          </p>
        </div>
        <div className="drv-hero-rating">
          <Star size={14} fill="currentColor" />
          <span>{user.rating?.count ? Number(user.rating.average).toFixed(2) : "—"}</span>
        </div>
      </button>

      <AccountModeSwitch mode="rider"/>

      {/* ── Grille 2x2 des outils essentiels ── */}
      <h2 className="drv-grid-title">Espace de conduite</h2>
      <Link href="/contact?topic=fleet" className="btn btn-secondary mb-4">Ma flotte et mon véhicule</Link>
      <div className="drv-tiles-grid">
        <button type="button" className="drv-tile" onClick={() => setGoldOpen(true)}>
          <div className="drv-tile-icon"><Crown size={22} /></div>
          <strong>StrasDrive Gold</strong>
          <span>Gérer mon abonnement</span>
          <ChevronRight size={16} className="drv-tile-arrow" />
        </button>
        <Link href="/driver/profile" className="drv-tile">
          <div className="drv-tile-icon">
            <Car size={22} />
          </div>
          <strong>Véhicule & Documents</strong>
          <span>Gérer l'agrément et l'assurance</span>
          <ChevronRight size={16} className="drv-tile-arrow" />
        </Link>

        <Link href="/driver/wallet" className="drv-tile">
          <div className="drv-tile-icon">
            <CreditCard size={22} />
          </div>
          <strong>Portefeuille & Virements</strong>
          <span>Solde et retraits automatiques</span>
          <ChevronRight size={16} className="drv-tile-arrow" />
        </Link>

        <Link href="/driver/preferences" className="drv-tile">
          <div className="drv-tile-icon">
            <SlidersHorizontal size={22} />
          </div>
          <strong>Préférences de course</strong>
          <span>Espèces, note min, GPS</span>
          <ChevronRight size={16} className="drv-tile-arrow" />
        </Link>

        <button onClick={() => setWaybill(true)} className="drv-tile">
          <div className="drv-tile-icon">
            <FileCheck size={22} />
          </div>
          <strong>Feuille de route VTC</strong>
          <span>Registre officiel de la journée</span>
          <ArrowUpRight size={16} className="drv-tile-arrow" />
        </button>
      </div>

      {/* ── Raccourcis complémentaires ── */}
      <h2 className="drv-grid-title">Assistance & Légal</h2>
      <div className="drv-group">
        <Link href="/driver/inbox" className="driver-menu-row">
          <span className="drv-ico">
            <HelpCircle size={18} />
          </span>
          <span>
            Assistance StrasDrive<small>Discuter avec l'équipe de régulation</small>
          </span>
          <ChevronRight size={18} />
        </Link>
        <button onClick={() => setPanel("safety")} className="driver-menu-row">
          <span className="drv-ico">
            <ShieldCheck size={18} />
          </span>
          <span>
            Sécurité & Charte<small>Conseils et respect de la législation</small>
          </span>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── Déconnexion ── */}
      <div className="drv-logout-wrap">
        <button className="drv-logout-btn" onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut size={16} /> Se déconnecter
        </button>
      </div>

      <DriverProfileOverview open={overviewOpen} onClose={() => setOverviewOpen(false)} />
      <Modal
        open={goldOpen ?? (waitingForStripe || goldReturn === "manage")}
        onClose={() => setGoldOpen(false)}
        title="StrasDrive Gold"
        portal
        sheetOnMobile={false}
        maxWidth={620}
      >
        {goldError ? (
          <div role="alert">
            <p>Impossible de charger votre abonnement.</p>
            <button type="button" className="btn btn-secondary mt-2" onClick={reloadGold}>Réessayer</button>
          </div>
        ) : goldData?.gold ? (
          <DriverGoldCard gold={goldData.gold} waitingForStripe={waitingForStripe} />
        ) : <p role="status">Chargement de votre abonnement…</p>}
      </Modal>
      <Waybill open={waybill} onClose={() => setWaybill(false)} />
      <Modal open={panel !== null} onClose={() => setPanel(null)} title="Sécurité & Assistance">
        <div className="flex-col gap-3">
          <p>
            Retrouvez vos documents professionnels, la discussion avec le client et les informations de votre course
            dans l’application.
          </p>
          <Link href="/driver/profile#driver-documents">Mes documents</Link>
          <Link href="/driver/inbox">Contacter l’administration</Link>
        </div>
      </Modal>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/driver/menu")({
  head: () => ({ meta: [{"title": "Menu chauffeur · StrasDrive"}, {"name": "description", "content": "Votre profil, documents, préférences et assistance chauffeur StrasDrive."}, {"property": "og:title", "content": "Menu chauffeur · StrasDrive"}, {"property": "og:description", "content": "Votre profil, documents, préférences et assistance chauffeur StrasDrive."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }),
  component: () => (
    <DriverLayout>
      <DriverMenuPage />
    </DriverLayout>
  ),
});
