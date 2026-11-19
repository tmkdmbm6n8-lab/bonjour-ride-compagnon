import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useSession } from "@/lib/archive-auth";
import Link from "@/lib/archive-navigation";
import {
  Zap,
  ShieldCheck,
  Wallet,
  Radio,
  Route as RouteIcon,
  Car,
  PawPrint,
  Users,
  ArrowRight,
  Star,
  Clock,
  MessageCircle,
} from "lucide-react";
import SiteHeader from "@/components/shell/SiteHeader";
import SiteFooter from "@/components/shell/SiteFooter";
import HomeRideEstimator from "@/components/home/HomeRideEstimator";
import { getRandomRideSummary } from "@/lib/vtc.functions";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const { session } = useSession();
  
  // État de la vraie course tirée aléatoirement
  const [realRide, setRealRide] = useState({
    driverName: "Chauffeur",
    vehicleText: "Honda Jazz grise · CG762ZM",
    approachMin: 3,
    durationMin: 12,
    distanceKm: "4,8",
    fareTotal: "11,20",
  });

  useEffect(() => {
    getRandomRideSummary()
      .then((data) => {
        if (data) setRealRide(data);
      })
      .catch((err) => console.error("Erreur chargement course réelle:", err));
  }, []);

  // Redirection si déjà connecté
  if (session && !Capacitor.isNativePlatform()) {
    const destination =
      session.user.role === "driver"
        ? "/driver/dashboard"
        : session.user.role === "admin"
          ? "/admin/dashboard"
          : "/dashboard";
    return <Navigate to={destination} replace />;
  }

  return (
    <div className="landing-page brand-theme">
      <SiteHeader />

      {/* ── Hero (Skyline supprimée) ── */}
      <section className="landing-hero">
        <div className="landing-estimator-wrap">
          <HomeRideEstimator />
        </div>
        <h1 className="display landing-confidence">
          Voyagez en toute <span>confiance</span>.
        </h1>

        {/* Vraie course d'un vrai chauffeur aléatoire — même visuel */}
        <div
          className="card"
          style={{
            margin: "48px auto 0",
            width: "100%",
            maxWidth: 720,
            padding: 28,
            boxShadow: "var(--shadow-lg)",
            borderRadius: "var(--radius-xl)",
          }}
        >
          <div className="flex items-center justify-between wrap gap-4">
            <div className="flex items-center gap-4">
              <span className="avatar avatar-lg" style={{ background: "var(--ink-950)" }}>
                <Car size={22} color="#fff" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span style={{ fontWeight: 700 }}>
                    {realRide.driverName} en route
                  </span>
                  <span className="badge badge-gold badge-dot">
                    {realRide.approachMin} min
                  </span>
                </div>
                <span className="small muted">{realRide.vehicleText}</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2 small muted">
                <Clock size={15} /> Trajet de {realRide.durationMin} min
              </span>
              <span className="flex items-center gap-2 small muted">
                <RouteIcon size={15} /> {realRide.distanceKm} km
              </span>
              <span style={{ fontWeight: 800, fontSize: "1.2rem" }} className="mono-nums">
                {realRide.fareTotal} €
              </span>
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "var(--ink-100)", marginTop: 22, overflow: "hidden" }}>
            <div
              style={{
                width: "62%",
                height: "100%",
                borderRadius: 4,
                background: "linear-gradient(90deg, var(--ink-900), var(--gold-600))",
              }}
            />
          </div>
        </div>
      </section>

      {/* Reste de la page inchangé */}
...
