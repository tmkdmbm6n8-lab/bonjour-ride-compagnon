import { createFileRoute } from "@tanstack/react-router";
import DriverLayout from "@/components/DriverLayout";
import { apiFetch as fetch } from "@/lib/archive-fetch";
import { useEffect, useState } from "react";
import Link from "@/lib/archive-navigation";
import {
  X,
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
import { NAV_APPS, getNavApp, setNavApp } from "@/lib/navigation";
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
  const [navApp, setNavAppState] = useState(null);

  useEffect(() => {
    setNavAppState(getNavApp());
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


  return (
    <div className="driver-tab-page driver-preferences">
      <div className="drv-home-inner">
        <div className="drv-pref-head">
          <h1>Préférences</h1>
          <Link href="/driver/menu" className="driver-icon-button" aria-label="Fermer les préférences"><X size={22} /></Link>
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

            <div className="drv-divider" />

            <h2 className="drv-pref-title">Filtres et options de course</h2>
            <div className="drv-list">
              <button
                type="button"
                className="drv-row"
                role="switch"
                aria-checked={prefs.acceptCash}
                disabled={busy === "cash"}
                onClick={() =>
                  setPrefs(
                    "cash",
                    { acceptCash: !prefs.acceptCash },
                    prefs.acceptCash ? "Vous ne recevrez plus les courses payées en espèces" : "Courses en espèces acceptées",
                  )
                }
              >
                <Banknote size={24} />
                <span className="drv-row-label">Accepter les espèces</span>
                <Switch on={prefs.acceptCash} busy={busy === "cash"} />
              </button>

              <button
                type="button"
                className="drv-row"
                role="switch"
                aria-checked={prefs.minRiderRating != null}
                disabled={busy === "rating"}
                onClick={() => {
                  if (prefs.minRiderRating != null) {
                    setOpen(null);
                    setPrefs("rating", { minRiderRating: null }, "Note minimale désactivée");
                  } else {
                    setOpen("rating");
                    setPrefs("rating", { minRiderRating: 4.5 }, "Note minimale : 4,5");
                  }
                }}
              >
                <Star size={24} />
                <span className="drv-row-label">
                  Note du passager
                  <span className="drv-row-sub">
                    {prefs.minRiderRating != null
                      ? `Uniquement les passagers notés ${num(prefs.minRiderRating, 1)} ou plus.`
                      : "Fixez une note minimale pour les demandes de course."}
                  </span>
                </span>
                <Switch on={prefs.minRiderRating != null} busy={busy === "rating"} />
              </button>
              {prefs.minRiderRating != null && (
                <div className="drv-chips" role="radiogroup" aria-label="Note minimale du passager">
                  {MIN_RIDER_RATING_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={prefs.minRiderRating === r}
                      className={`drv-chip ${prefs.minRiderRating === r ? "on" : ""}`}
                      onClick={() => setPrefs("rating", { minRiderRating: r })}
                    >
                      <Star size={14} /> {num(r, 1)}+
                    </button>
                  ))}
                  <p className="drv-pref-note" style={{ width: "100%" }}>
                    Les nouveaux passagers (moins de 3 notes) restent toujours visibles.
                  </p>
                </div>
              )}

              <button
                type="button"
                className="drv-row"
                aria-expanded={open === "pay"}
                onClick={() => setOpen(open === "pay" ? null : "pay")}
              >
                <BarChart3 size={24} />
                <span className="drv-row-label">
                  Gain minimum
                  <span className="drv-row-sub">
                    {prefs.minPayPerKm != null
                      ? `${num(prefs.minPayPerKm)} €/km ou plus, approche comprise`
                      : "1,00 €/km ou plus (minimum garanti)"}
                  </span>
                </span>
                {open === "pay" ? (
                  <ChevronDown size={22} className="drv-row-chev" />
                ) : (
                  <ChevronRight size={22} className="drv-row-chev" />
                )}
              </button>
              {open === "pay" && (
                <div className="drv-options" role="radiogroup" aria-label="Gain minimum par km">
                  {[null, ...MIN_PAY_PER_KM_OPTIONS].map((v) => {
                    const on = prefs.minPayPerKm === v;
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`drv-option ${on ? "on" : ""}`}
                        disabled={busy === "pay"}
                        onClick={() =>
                          setPrefs(
                            "pay",
                            { minPayPerKm: v },
                            v == null ? "Gain minimum retiré" : `Gain minimum : ${num(v)} €/km`,
                          )
                        }
                      >
                        <span>{v == null ? "1,00 €/km (minimum garanti)" : `${num(v)} €/km ou plus`}</span>
                        <span className="drv-radio" aria-hidden="true" />
                      </button>
                    );
                  })}
                  <p className="drv-pref-note">
                    Gain net par km, trajet d’approche compris. Plus le minimum est haut, moins vous recevez de demandes.
                  </p>
                </div>
              )}
            </div>

            <div className="drv-divider" />

            <h2 className="drv-pref-title">Navigation</h2>
            <div className="drv-list">
              {Object.entries(NAV_APPS).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`drv-row drv-option-row ${navApp === id ? "on" : ""}`}
                  role="radio"
                  aria-checked={navApp === id}
                  onClick={() => chooseNavApp(id)}
                >
                  <Navigation size={24} />
                  <span className="drv-row-label">{label}</span>
                  <span className="drv-radio" aria-hidden="true" />
                </button>
              ))}
              <p className="small muted" style={{padding:'12px 16px'}}>Votre GPS choisi s’ouvre directement au clic sur « Démarrer le trajet ». Sans choix enregistré, les trois applications vous seront proposées.</p>
              {navApp && <button type="button" className="btn btn-ghost btn-sm" onClick={()=>chooseNavApp(null)}>Effacer le choix du GPS</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/driver/preferences")({
  head: () => ({
    meta: [
      { title: "Préférences de conduite · StrasDrive" },
      {
        name: "description",
        content: "Choisissez les courses StrasDrive que vous recevez : gammes, espèces, note du passager et gain minimum.",
      },
      { property: "og:title", content: "Préférences de conduite · StrasDrive" },
      {
        property: "og:description",
        content: "Choisissez les courses StrasDrive que vous recevez : gammes, espèces, note du passager et gain minimum.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <DriverLayout>
      <PreferencesPage />
    </DriverLayout>
  ),
});
