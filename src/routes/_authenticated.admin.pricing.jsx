import { createFileRoute } from "@tanstack/react-router";
import AdminLayout from "@/components/AdminLayout";
import { apiFetch as fetch } from "@/lib/archive-fetch";
("use client");

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Loading, VEHICLE_LABELS } from "@/components/ui/bits";
import { useToast } from "@/components/ui/Toast";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PRICING } from "@/lib/vtc-pricing";

const FIELDS = [
  ["baseFare", "Prise en charge (€)"],
  ["perKmRate", "Par km (€)"],
  ["perMinRate", "Par minute (€)"],
  ["minimumFare", "Tarif minimum (€)"],
  ["bookingFee", "Frais de réservation (€)"],
  ["platformCommission", "Commission (%)"],
  ["surgeMultiplierCap", "Plafond de majoration (×)"],
];

function AdminPricingPage() {
  const toast = useToast();
  const [rules, setRules] = useState(null);
  const [savingType, setSavingType] = useState(null);

  // État de la réduction Uber
  const [uberDiscount, setUberDiscount] = useState({ enabled: true, ratePct: 20 });
  const [savingUber, setSavingUber] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [showCookieBox, setShowCookieBox] = useState(false);
  const [savingCookie, setSavingCookie] = useState(false);
  const [cookieStatus, setCookieStatus] = useState(null);
  const [hourlyChecks, setHourlyChecks] = useState({ enabled: false });
  const [checkingUber, setCheckingUber] = useState(false);

  async function updateHourlyChecks(enabled) {
    setCheckingUber(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleType: "uber_hourly_checks", enabled }),
      });
      if (!res.ok) throw new Error("Enregistrement impossible");
      setHourlyChecks((prev) => ({ ...prev, enabled }));
      toast(enabled ? "Vérification horaire activée" : "Vérification horaire désactivée", "success");
    } catch {
      toast("Impossible de modifier la vérification horaire", "error");
    } finally {
      setCheckingUber(false);
    }
  }

  async function testHourlyCheck() {
    setCheckingUber(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleType: "uber_hourly_check_now" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de vérification");
      setHourlyChecks((prev) => ({ ...prev, lastCheckedAt: data.checkedAt, lastSuccess: data.ok, lastProductCount: data.products }));
      toast(data.ok ? "Tarifs Uber reçus" : "Uber indisponible : vérifier la session", data.ok ? "success" : "error");
    } catch {
      toast("Impossible de vérifier la session Uber", "error");
    } finally {
      setCheckingUber(false);
    }
  }

  async function saveCookie() {
    if (!cookieInput.trim()) {
      toast("Veuillez coller le cookie Uber avant de valider", "error");
      return;
    }
    setSavingCookie(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleType: "uber_cookie", cookie: cookieInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Session refusée par Uber", "error", 6000);
      } else {
        toast(`Connexion Uber validée (${data.count} gammes détectées)`, "success", 5000);
        setCookieStatus({ hasCustomCookie: true, updatedAt: new Date().toISOString() });
        setCookieInput("");
        setShowCookieBox(false);
      }
    } catch {
      toast("Erreur lors de la validation du cookie", "error");
    } finally {
      setSavingCookie(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/pricing");
        const data = await res.json();
        if (ignore || !res.ok) return;

        if (data.uberCookieStatus) setCookieStatus(data.uberCookieStatus);
        if (data.uberHourlyChecks) setHourlyChecks(data.uberHourlyChecks);

        // Récupérer la règle Uber
        const dbUber = data.rules?.find((r) => r.vehicleType === "uber_discount");
        if (dbUber) {
          setUberDiscount({
            enabled: Boolean(dbUber.enabled),
            ratePct: Number.isFinite(dbUber.rate) ? Math.round(dbUber.rate * 100) : 20,
          });
        }

        // Fusionner les règles par véhicule
        const merged = {};
        for (const type of Object.keys(DEFAULT_PRICING)) {
          const dbRule = data.rules?.find((r) => r.vehicleType === type && r.city === "default");
          merged[type] = dbRule
            ? { ...DEFAULT_PRICING[type], ...dbRule }
            : { ...DEFAULT_PRICING[type], _unsaved: true };
        }
        setRules(merged);
      } catch {
        if (!ignore) setRules(null);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const setField = (type, field) => (e) => setRules((r) => ({ ...r, [type]: { ...r[type], [field]: e.target.value } }));

  async function saveUberDiscount() {
    setSavingUber(true);
    try {
      const payload = {
        vehicleType: "uber_discount",
        enabled: Boolean(uberDiscount.enabled),
        rate: Math.max(0, Math.min(100, parseFloat(uberDiscount.ratePct) || 0)) / 100,
      };

      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Échec de l’enregistrement", "error", 5000);
      } else {
        toast(
          `Réduction Uber ${uberDiscount.enabled ? `activée à -${uberDiscount.ratePct}%` : "désactivée (prix Uber brut)"}`,
          "success",
        );
      }
    } catch {
      toast("Échec de l’enregistrement", "error");
    } finally {
      setSavingUber(false);
    }
  }

  async function save(type) {
    setSavingType(type);
    try {
      const rule = rules[type];
      const payload = { vehicleType: type, city: "default", isActive: true };
      for (const [field] of FIELDS) payload[field] = parseFloat(rule[field]);

      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Échec de l’enregistrement", "error", 5000);
      } else {
        setRules((r) => ({ ...r, [type]: { ...r[type], ...data.rule, _unsaved: false } }));
        toast(`Tarification ${VEHICLE_LABELS[type] || type} enregistrée`, "success");
      }
    } catch {
      toast("Échec de l’enregistrement", "error");
    } finally {
      setSavingType(null);
    }
  }

  if (!rules)
    return (
      <div className="content-pad">
        <Loading label="Chargement des tarifs…" />
      </div>
    );

  return (
    <div className="content-pad" style={{ maxWidth: 900 }}>
      <h1 className="page-title">Tarification</h1>
      <p className="page-sub mb-6">
        Règles tarifaires et synchronisation des prix. Les passagers voient toujours le prix final avant de réserver.
      </p>

      {/* ── Encart Réduction Uber en direct ── */}
      <div className="card card-pad mb-8" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: "var(--primary)" }} />
            <h3 style={{ fontSize: "1.1rem", margin: 0 }}>Tarifs en direct Uber</h3>
          </div>
          <span className={`badge ${uberDiscount.enabled ? "badge-success" : "badge-neutral"}`}>
            {uberDiscount.enabled
              ? `Réduction -${uberDiscount.ratePct}% active`
              : "Réduction désactivée (100% prix Uber)"}
          </span>
        </div>

        <p className="small muted mb-4">
          Activez ou désactivez la remise appliquée sur les prix renvoyés par l'API Uber en direct. La garantie minimale
          ARPE (9 € nets chauffeur) reste toujours protégée.
        </p>

        <div
          className="flex items-center justify-between gap-4 p-4 rounded-lg mb-4"
          style={{ background: "var(--muted)/15", border: "1px solid var(--border)" }}
        >
          <div className="flex-1">
            <label htmlFor="uber-toggle" className="font-semibold cursor-pointer block" style={{ fontSize: "0.95rem" }}>
              Appliquer une réduction par rapport à Uber
            </label>
            <span className="tiny muted">
              {uberDiscount.enabled
                ? "Les clients paient moins cher qu’Uber selon le pourcentage défini ci-contre."
                : "Les clients paient exactement le prix Uber brut en direct (0% de remise)."}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="uber-toggle"
              checked={uberDiscount.enabled}
              onCheckedChange={(checked) => setUberDiscount((prev) => ({ ...prev, enabled: checked }))}
            />
            <span className="small font-semibold" style={{ minWidth: 40 }}>
              {uberDiscount.enabled ? "ON" : "OFF"}
            </span>
          </div>
        </div>

        {uberDiscount.enabled && (
          <div className="flex items-center gap-3 mb-4" style={{ maxWidth: 280 }}>
            <label htmlFor="uber-pct" className="small" style={{ whiteSpace: "nowrap" }}>
              Pourcentage de réduction :
            </label>
            <div className="flex items-center gap-1">
              <input
                id="uber-pct"
                className="input"
                style={{ width: 80, minHeight: 38, textAlign: "center" }}
                type="number"
                min="0"
                max="100"
                step="1"
                value={uberDiscount.ratePct}
                onChange={(e) => setUberDiscount((prev) => ({ ...prev, ratePct: e.target.value }))}
              />
              <span className="small font-semibold">%</span>
            </div>
          </div>
        )}

        <button className="btn btn-primary btn-sm" onClick={saveUberDiscount} disabled={savingUber}>
          {savingUber ? (
            <span className="spinner" />
          ) : (
            <>
              <Check size={14} /> Enregistrer la règle Uber
            </>
          )}
        </button>
      </div>

      <div className="card card-pad mb-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <strong>Session Uber (cookie)</strong>
          <button type="button" className="btn btn-secondary btn-xs" onClick={() => setShowCookieBox(!showCookieBox)}>
            {showCookieBox ? "Fermer" : "Modifier le cookie Uber"}
          </button>
        </div>
        <p className="tiny muted mb-3">
          {cookieStatus?.hasCustomCookie
            ? `Session enregistrée le ${cookieStatus.updatedAt ? new Date(cookieStatus.updatedAt).toLocaleString("fr-FR") : "—"} (validité non garantie).`
            : "Aucun cookie personnalisé enregistré. Repli sur UBER_COOKIE si configuré."}
        </p>
        {showCookieBox && (
          <div className="flex-col gap-2">
            <textarea
              className="input"
              rows={3}
              style={{ fontSize: "0.8rem", fontFamily: "monospace" }}
              placeholder="Coller ici le cookie de votre propre session Uber"
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
              autoComplete="off"
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={saveCookie} disabled={savingCookie}>
              {savingCookie ? "Validation…" : "Tester et enregistrer le cookie"}
            </button>
          </div>
        )}
      </div>

      <div className="card card-pad mb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <strong>Simulation de tarifs Uber chaque heure</strong>
            <p className="tiny muted mt-1">Trajets fictifs aléatoires autour de Strasbourg, sans réservation.</p>
          </div>
          <Switch checked={hourlyChecks.enabled === true} onCheckedChange={updateHourlyChecks} disabled={checkingUber} aria-label="Activer les vérifications horaires Uber" />
        </div>
        <p className="tiny muted mt-2">
          {hourlyChecks.lastCheckedAt
            ? `Dernier test : ${new Date(hourlyChecks.lastCheckedAt).toLocaleString("fr-FR")} — ${hourlyChecks.lastSuccess ? "Réussi" : "Échec"}`
            : "Aucun test enregistré."}
        </p>
        <p className="tiny muted mt-2">L'exécution toutes les heures nécessite un planificateur serveur configuré. Cette option seule ne démarre pas de tâche en arrière-plan.</p>
        <button type="button" className="btn btn-secondary btn-sm mt-3" disabled={checkingUber} onClick={testHourlyCheck}>
          {checkingUber ? "Vérification…" : "Tester maintenant"}
        </button>
      </div>

      <h2 style={{ fontSize: "1.15rem", marginBottom: 12 }}>Grille tarifaire de secours (StrasDrive)</h2>
      <p className="small muted mb-6">
        Appliquée automatiquement si l'API Uber est momentanément injoignable. Aucun tarif ne descend sous le plancher
        ARPE (9 € nets par course, 30 € nets/h, 1 € net/km).
      </p>

      {/* ── Cartes par gamme ── */}
      <div className="grid-2">
        {Object.keys(DEFAULT_PRICING).map((type) => (
          <div key={type} className="card card-pad">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontSize: "1.05rem" }}>{VEHICLE_LABELS[type] || type}</h3>
              {rules[type]._unsaved && <span className="badge badge-warning">Valeurs par défaut utilisées</span>}
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              {FIELDS.map(([field, label]) => (
                <div key={field} className="field">
                  <label htmlFor={`${type}-${field}`} className="tiny">
                    {label}
                  </label>
                  <input
                    id={`${type}-${field}`}
                    className="input"
                    style={{ minHeight: 40 }}
                    type="number"
                    step="0.05"
                    min="0"
                    value={rules[type][field]}
                    onChange={setField(type, field)}
                  />
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-sm mt-4" onClick={() => save(type)} disabled={savingType === type}>
              {savingType === type ? (
                <span className="spinner" />
              ) : (
                <>
                  <Check size={14} /> Enregistrer
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  head: () => ({
    meta: [
      { title: "Tarification · StrasDrive" },
      {
        name: "description",
        content: "StrasDrive — tarification, service de mise en relation VTC et tarifs en euros.",
      },
      { property: "og:title", content: "Tarification · StrasDrive" },
      {
        property: "og:description",
        content: "StrasDrive — tarification, service de mise en relation VTC et tarifs en euros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AdminLayout>
      <AdminPricingPage />
    </AdminLayout>
  ),
});
