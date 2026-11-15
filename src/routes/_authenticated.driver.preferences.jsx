import { createFileRoute } from "@tanstack/react-router";
import DriverLayout from "@/components/DriverLayout";
import { apiFetch as fetch } from "@/lib/archive-fetch";
import { useEffect, useState } from "react";
import Link from "@/lib/archive-navigation";
import {
  ArrowLeft,
  Check,
  UserRound,
  Armchair,
  PawPrint,
  Users,
  Banknote,
  Star,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Navigation,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { VEHICLE_LABELS } from "@/components/ui/bits";
import { NAV_APPS, getNavApp, setNavApp, getNavAuto, setNavAuto } from "@/lib/navigation";
import {
  DEFAULT_TRIP_PREFS,
  MIN_RIDER_RATING_OPTIONS,
  MIN_PAY_PER_KM_OPTIONS,
  isFiltering,
} from "@/lib/vtc-trip-prefs";

const CLASS_ICONS = { economy: UserRound, comfort: Armchair, pet: PawPrint, xl: Users };
const num = (n, d = 2) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

function Switch({ on, busy }) {
  return (
    <span className={`drv-switch ${on ? "on" : ""}`} aria-hidden="true">
      {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <span className="knob" />}
    </span>
  );
}

function PreferencesPage() {
  const toast = useToast();
  const [driver, setDriver] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(null); // "rating" | "pay" | null
  const [navApp, setNavAppState] = useState("google");
  const [navAuto, setNavAutoState] = useState(true);

  useEffect(() => {
    setNavAppState(getNavApp());
    setNavAutoState(getNavAuto());
    let alive = true;
    fetch("/api/drivers/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setDriver(d.driver))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const prefs = driver?.tripPrefs || DEFAULT_TRIP_PREFS;
  const own = driver?.vehicleClass || "economy";
  const lower = driver?.lowerClasses || [];
  const accepted = driver?.acceptsClasses || [];

  async function save(key, path, body, okMessage) {
    setBusy(key);
    try {
      const res = await fetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) toast(data.error || "Impossible d’enregistrer", "error");
      else {
        setDriver(data.driver);
        if (okMessage) toast(okMessage, "success", 2500);
      }
    } catch {
      toast("Impossible d’enregistrer", "error");
    } finally {
      setBusy(null);
    }
  }

  const toggleClass = (cls) => {
    const on = accepted.includes(cls);
    const next = on ? accepted.filter((c) => c !== cls) : [...accepted, cls];
    save(
      `class-${cls}`,
      "/api/drivers/me/classes",
      { acceptsClasses: next },
      on ? `Vous ne recevrez plus les courses ${VEHICLE_LABELS[cls]}` : `Courses ${VEHICLE_LABELS[cls]} activées`,
    );
  };
  const setPrefs = (key, patch, msg) => save(key, "/api/drivers/me/preferences", { tripPrefs: patch }, msg);

  const chooseNavApp = (app) => {
    setNavApp(app);
    setNavAppState(app);
  };
  const toggleNavAuto = () => {
    setNavAuto(!navAuto);
    setNavAutoState(!navAuto);
  };

  return (
    <div className="drv-home">
      <div className="drv-home-inner">
        <div className="drv-pref-head">
          <Link href="/driver/dashboard" className="drv-back" aria-label="Retour">
            <ArrowLeft size={26} />
          </Link>
          <h1>Préférences</h1>
        </div>

        {failed ? (
          <p className="drv-pref-note mt-4">Impossible de charger vos préférences. Vérifiez votre connexion et réessayez.</p>
        ) : !driver ? (
          <div className="flex justify-center mt-6">
            <span className="spinner" />
          </div>
        ) : (
          <>
            {isFiltering(prefs) && <div className="drv-banner">Courses filtrées selon vos préférences</div>}

            <h2 className="drv-pref-title">Services</h2>
            <div className="drv-tiles">
              <div className="drv-tile on locked" aria-label={`${VEHICLE_LABELS[own]}, votre gamme, toujours activée`}>
                <span className="drv-check" aria-hidden="true">
                  <Check size={18} strokeWidth={3} />
                </span>
                {(() => {
                  const Icon = CLASS_ICONS[own] || UserRound;
                  return <Icon size={34} strokeWidth={1.8} />;
                })()}
                <span className="drv-tile-label">{VEHICLE_LABELS[own]}</span>
                <span className="drv-tile-hint">Votre gamme</span>
              </div>
              {lower.map((cls) => {
                const Icon = CLASS_ICONS[cls] || UserRound;
                const on = accepted.includes(cls);
                return (
                  <button
                    key={cls}
                    type="button"
                    className={`drv-tile ${on ? "on" : ""}`}
                    role="checkbox"
                    aria-checked={on}
                    disabled={busy === `class-${cls}`}
                    onClick={() => toggleClass(cls)}
                  >
                    <span className="drv-check" aria-hidden="true">
                      {busy === `class-${cls}` ? (
                        <span className="spinner" style={{ width: 14, height: 14 }} />
                      ) : (
                        on && <Check size={18} strokeWidth={3} />
                      )}
                    </span>
                    <Icon size={34} strokeWidth={1.8} />
                    <span className="drv-tile-label">{VEHICLE_LABELS[cls]}</span>
                    <span className="drv-tile-hint">Payée au tarif {VEHICLE_LABELS[cls]}</span>
                  </button>
                );
              })}
            </div>
            {lower.length === 0 && (
              <p className="drv-pref-note">Votre gamme reçoit uniquement ses propres courses.</p>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
