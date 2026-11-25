import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
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

type RideSummary = {
  driverName: string;
  driverAvatar?: string | null;
  vehicleText: string;
  approachMin: number;
  durationMin: number;
  distanceKm: string;
  fareTotal: string;
};

// Shown until a real completed ride is loaded (or when none exists yet).
const DEMO_RIDE: RideSummary = {
  driverName: "Chauffeur",
  driverAvatar: null,
  vehicleText: "Toyota Camry argentée",
  approachMin: 3,
  durationMin: 12,
  distanceKm: "4,8",
  fareTotal: "11,20",
};

const FEATURES = [
  {
    icon: Wallet,
    title: "Les chauffeurs conservent 85 %",
    text: "StrasDrive prélève 15 % de commission pour les courses ordinaires, et 0 % lorsque le chauffeur abonné Gold payant transporte son propre client privé.",
  },
  {
    icon: Zap,
    title: "Un chauffeur en quelques secondes",
    text: "Notre système d’attribution par grille hexagonale trouve le chauffeur disponible le plus proche et confirme rapidement votre course.",
  },
  {
    icon: Radio,
    title: "Suivi de course en direct",
    text: "Suivez l’approche de votre chauffeur en temps réel, de l’acceptation à l’arrivée, mètre par mètre.",
  },
  {
    icon: RouteIcon,
    title: "Des tarifs 20 % plus bas",
    text: "Nos tarifs sont 20 % plus bas que ceux de notre plus grand concurrent multinational. Le prix de votre course est annoncé avant la réservation.",
  },
  {
    icon: ShieldCheck,
    title: "Prises en charge vérifiées par code PIN",
    text: "Chaque course commence avec votre code PIN à 4 chiffres : vous montez ainsi toujours dans le bon véhicule.",
  },
  {
    icon: MessageCircle,
    title: "Discussion pendant la course",
    text: "Organisez la prise en charge sans communiquer votre numéro de téléphone.",
  },
];

const TIERS = [
  { icon: Car, name: "StrasDrive Go", text: "Des courses au quotidien à prix avantageux" },
  { icon: Car, name: "StrasDrive Comfort", text: "Voitures récentes, plus d’espace pour les jambes" },
  { icon: PawPrint, name: "StrasDrive Pet", text: "Transport avec animaux — cage de transport obligatoire" },
  { icon: Users, name: "StrasDrive XL", text: "De la place pour six personnes maximum" },
];

const STEPS = [
  {
    n: "01",
    title: "Indiquez votre destination",
    text: "Saisissez-la ou touchez la carte — les tarifs de chaque gamme s’affichent instantanément.",
  },
  {
    n: "02",
    title: "Trouvez votre chauffeur",
    text: "Le chauffeur le plus proche accepte et vous suivez son arrivée en direct.",
  },
  {
    n: "03",
    title: "Montez et partez",
    text: "Validez avec votre code PIN, profitez du trajet et payez avec votre portefeuille.",
  },
];

function StartupLogo({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const uid = useId().replace(/:/g, "");
  const road = useRef<SVGPathElement>(null);
  const arrow = useRef<SVGGElement>(null);
  const progress = useRef(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const path = road.current;
    const marker = arrow.current;
    if (!path || !marker) return;
    const length = path.getTotalLength();
    const start = Math.max(0, length - 5.2);
    const initial = progress.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let began: number | undefined;
    const tick = (now: number) => {
      began ??= now;
      const elapsed = now - began;
      const value = ready
        ? initial + (1 - initial) * Math.min(1, elapsed / 160)
        : Math.min(0.92, initial + (0.92 - initial) * (1 - Math.exp(-elapsed / 900)));
      progress.current = reduced ? (ready ? 1 : 0) : value;
      const at = start * (1 - progress.current);
      const point = path.getPointAtLength(at);
      const ahead = path.getPointAtLength(Math.max(0, at - 0.15));
      const behind = path.getPointAtLength(Math.min(length, at + 0.15));
      const angle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180 / Math.PI + 90;
      marker.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${angle})`);
      if (ready && progress.current >= 1) { done.current(); return; }
      if (!reduced) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready]);
  return (
    <div role="status" aria-label="Ouverture de StrasDrive" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b0c10" }}>
      <svg width="128" height="128" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={uid+"road"} x1="14" y1="8" x2="34" y2="40" gradientUnits="userSpaceOnUse"><stop stopColor="#FAFAF9"/><stop offset="1" stopColor="#E7E5E4"/></linearGradient>
          <linearGradient id={uid+"arrow"} x1="0" y1="-3.5" x2="0" y2="3" gradientUnits="userSpaceOnUse"><stop stopColor="#EAB308"/><stop offset="1" stopColor="#A16207"/></linearGradient>
          <radialGradient id={uid+"glow"}><stop stopColor="#EAB308" stopOpacity=".35"/><stop offset="1" stopColor="#EAB308" stopOpacity="0"/></radialGradient>
        </defs>
        <path ref={road} d="M29.2 15A6 6 0 1 0 24 24A6 6 0 1 1 18.8 33" stroke={`url(#${uid}road)`} strokeWidth="8" strokeLinecap="round"/>
        <path d="M29.2 15A6 6 0 1 0 24 24A6 6 0 0 1 25.55 35.8" stroke="#44403C" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2.2 2.4"/>
        <g ref={arrow} transform="translate(22.96 35.91) rotate(100)">
          <circle r="6" fill={`url(#${uid}glow)`}/>
          <path d="M0 -3.5L2.9 3L0 1.5L-2.9 3Z" fill={`url(#${uid}arrow)`} stroke="#0C0A09" strokeWidth=".7" strokeLinejoin="round"/>
          <path d="M0 -2.3L1.2 .6L0 .1Z" fill="#FEF9C3" fillOpacity=".55"/>
        </g>
      </svg>
    </div>
  );
}

function LandingPage() {
  const { data: session, status } = useSession() as { data: { user?: { role?: string } } | null; status: string };
  const [nativeApp, setNativeApp] = useState<boolean | null>(null);
  const [startupDone, setStartupDone] = useState(false);
  useEffect(() => {
    setNativeApp(Capacitor.isNativePlatform());
  }, []);
  const [ride, setRide] = useState<RideSummary>(DEMO_RIDE);
  useEffect(() => {
    let alive = true;
    getRandomRideSummary()
      .then((data) => {
        if (alive && data) setRide(data as RideSummary);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Restore the verified session before showing the public landing page.
  if (nativeApp === null || (nativeApp && (status === "loading" || !startupDone))) {
    return <StartupLogo ready={nativeApp === true && status !== "loading"} onDone={() => setStartupDone(true)} />;
  }
  if (nativeApp && session?.user) {
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

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-estimator-wrap">
          <HomeRideEstimator />
        </div>
        <h1 className="display landing-confidence">
          Voyagez en toute <span>confiance</span>.
        </h1>

        {/* Une vraie course terminée, tirée au hasard */}
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
                {ride.driverAvatar ? (
                  <img src={ride.driverAvatar} alt={ride.driverName} />
                ) : (
                  <Car size={22} color="#fff" />
                )}
              </span>

              <div>
                <div className="flex items-center gap-2">
                  <span style={{ fontWeight: 700 }}>{ride.driverName} en route</span>
                  <span className="badge badge-gold badge-dot">{ride.approachMin} min</span>
                </div>
                <span className="small muted">{ride.vehicleText}</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2 small muted">
                <Clock size={15} /> Trajet de {ride.durationMin} min
              </span>
              <span className="flex items-center gap-2 small muted">
                <RouteIcon size={15} /> {ride.distanceKm} km
              </span>
              <span style={{ fontWeight: 800, fontSize: "1.2rem" }} className="mono-nums">
                {ride.fareTotal} €
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

      {/* ── Features ── */}
      <section
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "72px 24px" }}>
          <span className="eyebrow">Pourquoi StrasDrive</span>
          <h2 style={{ fontSize: "2rem", marginTop: 10, maxWidth: 480 }}>
            {" "}
            Tout ce qu’une excellente course doit offrir{" "}
          </h2>
          <div className="grid-3 mt-8">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card card-pad" style={{ background: "var(--bg)" }}>
                <span
                  className="avatar"
                  style={{ background: "var(--gold-50)", color: "var(--gold-700)", borderRadius: 12 }}
                >
                  <Icon size={19} />
                </span>
                <h3 style={{ fontSize: "1.02rem", marginTop: 14 }}>{title}</h3>
                <p className="small muted mt-1" style={{ lineHeight: 1.6 }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "72px 24px" }}>
        <span className="eyebrow">Comment ça marche</span>
        <h2 style={{ fontSize: "2rem", marginTop: 10 }}>Trois gestes pour aller partout</h2>
        <div className="grid-3 mt-8">
          {STEPS.map((s) => (
            <div key={s.n}>
              <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--gold-500)", letterSpacing: "-0.03em" }}>
                {s.n}
              </span>
              <h3 style={{ fontSize: "1.05rem", marginTop: 8 }}>{s.title}</h3>
              <p className="small muted mt-1" style={{ lineHeight: 1.6, maxWidth: 280 }}>
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tiers ── */}
      <section style={{ background: "var(--ink-950)", color: "var(--text-invert)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "72px 24px" }}>
          <span className="eyebrow" style={{ color: "var(--gold-500)" }}>
            Choisissez votre course
          </span>
          <h2 style={{ fontSize: "2rem", marginTop: 10 }}>Une gamme pour chaque trajet</h2>
          <div className="grid-4 mt-8">
            {TIERS.map(({ icon: Icon, name, text }) => (
              <div
                key={name}
                className="card-pad"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <Icon size={22} style={{ color: "var(--gold-500)" }} />
                <h3 style={{ fontSize: "1rem", marginTop: 12 }}>{name}</h3>
                <p className="small mt-1" style={{ color: "rgba(250,250,249,0.65)" }}>
                  {text}
                </p>
              </div>
            ))}
          </div>

          <div
            className="flex items-center justify-between wrap gap-4"
            style={{
              marginTop: 56,
              padding: 28,
              borderRadius: "var(--radius-xl)",
              background: "linear-gradient(135deg, rgba(202,138,4,0.2), rgba(202,138,4,0.05))",
              border: "1px solid rgba(202,138,4,0.3)",
            }}
          >
            <div>
              <h3 style={{ fontSize: "1.3rem" }}>Transformez votre voiture en source de revenus</h3>
              <p className="small mt-1" style={{ color: "rgba(250,250,249,0.7)" }}>
                {" "}
                Conservez 85 % du prix de la course ordinaire, et 100 % lorsque vous transportez votre propre client privé avec Gold payant. Passez en ligne
                quand cela vous convient.{" "}
              </p>
            </div>
            <Link href="/signup?role=driver" className="btn btn-gold btn-lg">
              {" "}
              S’inscrire <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accueil · StrasDrive" },
      { name: "description", content: "StrasDrive — accueil, service de mise en relation VTC et tarifs en euros." },
      { property: "og:title", content: "Accueil · StrasDrive" },
      {
        property: "og:description",
        content: "StrasDrive — accueil, service de mise en relation VTC et tarifs en euros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});
