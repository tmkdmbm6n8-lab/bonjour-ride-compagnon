import UberBenchmarkChart from "@/components/admin/UberBenchmarkChart";
import { createFileRoute } from "@tanstack/react-router";
import AdminLayout from "@/components/AdminLayout";
import { apiFetch as fetch } from "@/lib/archive-fetch";
("use client");

import { useEffect, useState, useRef } from "react";
import { Check, Sparkles } from "lucide-react";
import { Loading, VEHICLE_LABELS } from "@/components/ui/bits";
import { useToast } from "@/components/ui/Toast";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PRICING } from "@/lib/vtc-pricing";
import UberAnalytics from "@/components/admin/UberAnalytics";

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
  const [pricingSource, setPricingSource] = useState("auto");
  const [sourceSaving, setSourceSaving] = useState(false);
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
  const [aiConfig, setAiConfig] = useState({ enabled: false, radiusKm: 100 });
  const [aiStats, setAiStats] = useState({ count: 0, recent: [] });
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiPredictionDistance, setAiPredictionDistance] = useState(9);
  const [aiPrediction, setAiPrediction] = useState(null);
  const aiInFlight = useRef(false);
  const [priceComparison, setPriceComparison] = useState(null);
  const [comparisonBusy, setComparisonBusy] = useState(false);
  const [comparisonMaxKm, setComparisonMaxKm] = useState(9);
  const [roadPool,setRoadPool]=useState(null);
  const [roadPoolRunning,setRoadPoolRunning]=useState(false);
  const [roadPoolError,setRoadPoolError]=useState("");
  const roadPoolBusy=useRef(false);
  async function loadRoadPool(){
    const res=await fetch("/api/admin/pricing-ai-road-pool");
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Réservoir indisponible : migration SQL 0024 requise");
    setRoadPool(data);return data;
  }
  useEffect(()=>{loadRoadPool().catch(e=>setRoadPoolError(e.message));},[]);
  useEffect(()=>{
    if(!roadPoolRunning)return;
    let active=true;
    const timer=setInterval(async()=>{
      if(!active||roadPoolBusy.current||document.visibilityState!=="visible")return;
      roadPoolBusy.current=true;
      try{
        const res=await fetch("/api/admin/pricing-ai-road-pool",{
          method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({limit:5})
        });
        const data=await res.json();
        if(!res.ok)throw new Error(data.error||"Génération impossible");
        if(!active)return;
        setRoadPool(data);setRoadPoolError("");
        if(data.total>=data.target)setRoadPoolRunning(false);
      }catch(e){if(active){setRoadPoolError(e.message);setRoadPoolRunning(false);}}
      finally{roadPoolBusy.current=false;}
    },1200);
    return()=>{active=false;clearInterval(timer);};
  },[roadPoolRunning]);
  const [autoCompare, setAutoCompare] = useState(false);
  const [bulkTarget, setBulkTarget] = useState(false);
  const [bulkDeadline, setBulkDeadline] = useState(null);
  const [bulkMessage, setBulkMessage] = useState("");
  const [autoStats, setAutoStats] = useState({tested:0,saved:0,errors:0});
  const autoBusy = useRef(false);
  async function comparePrices(automatic = false) {
    if (autoBusy.current) return;
    autoBusy.current = true;
    setComparisonBusy(true);
    if (!automatic) setPriceComparison(null);
    try {
      const res = await fetch("/api/admin/pricing-ai-compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({maxDistanceKm:comparisonMaxKm}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Comparaison impossible");
      setPriceComparison(data);
      if (automatic) setAutoStats(prev=>({...prev,tested:prev.tested+1,saved:prev.saved+(Number(data.savedCount)||0)}));
    } catch (error) {
      setPriceComparison({ error: error.message || "Comparaison impossible" });
      if (automatic) setAutoStats(prev=>({...prev,errors:prev.errors+1}));
    } finally { autoBusy.current = false; setComparisonBusy(false); }
  }

  useEffect(() => {
    if (!bulkTarget || !autoCompare) return;
    if (autoStats.saved >= 100000) {
      setAutoCompare(false);
      setBulkTarget(false);
      setBulkMessage("Objectif de 100 000 estimations atteint.");
    } else if (bulkDeadline && Date.now() >= bulkDeadline) {
      setAutoCompare(false);
      setBulkTarget(false);
      setBulkMessage(`10 minutes écoulées : ${autoStats.saved.toLocaleString("fr-FR")} estimations enregistrées.`);
    }
  }, [bulkTarget, autoCompare, autoStats.saved, bulkDeadline]);

  useEffect(() => {
    if (!autoCompare) return;
    // Serial requests: aim for 10 starts/second, but never overlap or
    // promise a throughput the address/Uber services cannot sustain.
    const timer=setInterval(()=>{
      if(document.visibilityState==="visible"&&!autoBusy.current && (!bulkTarget || (Date.now() < bulkDeadline && autoStats.saved < 100000))) comparePrices(true);
    },100);
    return ()=>clearInterval(timer);
  },[autoCompare,comparisonMaxKm,bulkTarget,bulkDeadline,autoStats.saved]);

  async function savePricingSource(mode) {
    setSourceSaving(true);
    try {
      const res = await fetch("/api/admin/pricing-source", {
        method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible");
      setPricingSource(data.mode);
      toast("Mode de tarification enregistré", "success");
    } catch (e) { toast(e.message || "Erreur de tarification", "error"); }
    finally { setSourceSaving(false); }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/pricing-source").then(r=>r.json()).then(data=>{
      if(active && ["auto","uber","ai"].includes(data.mode))setPricingSource(data.mode);
    }).catch(()=>{});
    return ()=>{active=false};
  }, []);

  async function loadAiStatus() {
    const res = await fetch("/api/admin/pricing-ai");
    if (!res.ok) return;
    const data = await res.json();
    setAiConfig(data.config);
    setAiStats(prev => ({ ...prev, count: data.count }));
  }

  async function loadAllAiObservations() {
    const all = [];
    let offset = 0;
    // Retrieve every page; the database has no artificial 1000-observation cutoff.
    while (true) {
      const res = await fetch(`/api/admin/pricing-ai-observations?offset=${offset}&limit=500`);
      if (!res.ok) throw new Error("Historique Uber indisponible");
      const page = await res.json();
      all.push(...(page.observations || []));
      if (!page.hasMore) break;
      offset = page.nextOffset;
    }
    setAiStats(prev => ({ ...prev, recent: all }));
  }

  async function saveAiConfig(next) {
    setAiBusy(true);
    try {
      const res = await fetch("/api/admin/pricing-ai", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Impossible d'enregistrer");
      const data = await res.json();
      setAiConfig({ enabled: data.enabled, radiusKm: data.radiusKm, testsPerSecond: data.testsPerSecond });
      if (data.enabled) setAiResult(null);
      toast(data.enabled ? "Collecte activée" : "Collecte arrêtée", "success");
    } catch {
      toast("Erreur de configuration IA", "error");
    } finally {
      setAiBusy(false);
    }
  }

  async function sampleAi() {
    if (aiInFlight.current) return;
    aiInFlight.current = true;
    try {
      const res = await fetch("/api/admin/pricing-ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sample" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiResult({ ok: false, error: data?.error || `Erreur HTTP ${res.status}` });
        return;
      }
      setAiResult(data);
      if (data.ok) { loadAiStatus().catch(() => {}); loadAllAiObservations().catch(() => {}); }
      if (data.stopped) {
        setAiConfig((prev) => ({ ...prev, enabled: false, stopReason: data.reason }));
        toast(data.reason || "Prix Uber indisponibles : IA arrêtée automatiquement", "error", 6000);
      } else if (res.status === 429) {
        setAiConfig((prev) => ({ ...prev, enabled: false }));
      }
    } catch (error) {
      setAiResult({ ok: false, error: error?.message || "Erreur réseau" });
    } finally {
      aiInFlight.current = false;
    }
  }

  async function predictAi() {
    const res = await fetch("/api/admin/pricing-ai", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "predict", distanceKm: Number(aiPredictionDistance), productName: "UberX" }),
    });
    if (res.ok) setAiPrediction(await res.json());
  }

  useEffect(() => {
    loadAiStatus().catch(() => {});
    loadAllAiObservations().catch(() => {});
    // Keep the observation count current when clients request prices elsewhere.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") loadAiStatus().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!aiConfig.enabled) return;
    // This intensive mode runs only while the admin page remains open.
    // Run immediately on activation, then serialize requests with a minimum 1-second interval.
    if (document.visibilityState === "visible") sampleAi();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") sampleAi();
    }, Math.max(1000, Math.round(1000 / (Number(aiConfig.testsPerSecond) || 0.2))));
    return () => clearInterval(timer);
  }, [aiConfig.enabled, aiConfig.testsPerSecond]);

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

  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/admin/pricing", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (data.uberCookieStatus) setCookieStatus(data.uberCookieStatus);
      } catch { /* Keep the last known status on network failures. */ }
    };
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, []);

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
        {cookieStatus?.session && (
          <div className="tiny mb-3" role="status" aria-live="polite">
            {cookieStatus.session.status === "expired" ? (
              <span style={{ color: "#dc2626", fontWeight: 700 }}>Session Uber : JWT expiré. Remplacez le cookie pour reprendre les comparaisons.</span>
            ) : cookieStatus.session.status === "expiring_soon" ? (
              <span style={{ color: "#b45309", fontWeight: 700 }}>Session Uber : expiration prévue dans moins de 2 heures. Préparez une reconnexion.</span>
            ) : cookieStatus.session.status === "valid_until" ? (
              <span>JWT Uber : expiration théorique le {new Date(cookieStatus.session.expiresAt).toLocaleString("fr-FR")}. Uber peut invalider la session plus tôt.</span>
            ) : cookieStatus.session.status === "missing" ? (
              <span>Session Uber non configurée.</span>
            ) : (
              <span>Expiration Uber inconnue : vérifiez la session avec un test de tarif.</span>
            )}
          </div>
        )}
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

      <div className="card card-pad mb-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 style={{ fontSize: "1.1rem" }}>IA Tarification · Laboratoire</h3>
            <p className="tiny muted">Apprentissage continu sur des estimations, sans commander de courses.</p>
          </div>
          <span className={`badge ${aiConfig.enabled ? "badge-success" : "badge-neutral"}`}>
            {aiConfig.enabled ? "Collecte active" : "À l'arrêt"}
          </span>
        </div>
        <div className="mb-4" style={{border:"1px solid var(--border, #555)",borderRadius:12,padding:14}}>
          <h4 style={{fontWeight:700,marginBottom:6}}>Réservoir de 9 000 trajets réels · Strasbourg</h4>
          <p className="small muted mb-2">Google Maps Routes valide la distance réellement parcourue en voiture. 1 000 paires uniques par tranche, de 500 m à 9 km. Les deux outils IA partagent ce réservoir. La génération utilise des requêtes Google Maps et peut entraîner des frais.</p>
          <p className="small">Progression : <strong>{(roadPool?.total||0).toLocaleString("fr-FR")} / 9 000</strong> trajets</p>
          <progress value={roadPool?.total||0} max={9000} style={{width:"100%"}} />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(125px,1fr))",gap:8,marginTop:10}}>
            {(roadPool?.bands||[]).map(b=><div key={b.key} className="small">
              <strong>{b.key} km</strong> : {b.count} / 1 000
              <progress value={b.count} max={1000} style={{width:"100%"}} />
            </div>)}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button type="button" className="btn btn-primary btn-sm" disabled={roadPoolRunning||roadPool?.total>=9000}
              onClick={()=>{setRoadPoolError("");setRoadPoolRunning(true);}}>Constituer les 9 000 trajets</button>
            {roadPoolRunning&&<button type="button" className="btn btn-secondary btn-sm" onClick={()=>setRoadPoolRunning(false)}>Arrêter</button>}
            <button type="button" className="btn btn-secondary btn-sm" onClick={()=>loadRoadPool().catch(e=>setRoadPoolError(e.message))}>Actualiser</button>
          </div>
          {roadPoolRunning&&<p className="tiny muted mt-2">Génération progressive pendant que cette page reste ouverte et visible. Les doublons sont refusés par la base.</p>}
          {roadPoolError&&<p role="alert" className="small mt-2" style={{color:"#e66"}}>{roadPoolError}</p>}
        </div>
        <label className="small font-semibold" htmlFor="ai-radius">Rayon de recherche autour de Strasbourg (km)</label>
        <div className="flex items-center gap-3 mt-2 mb-3">
          <input id="ai-radius" className="input" type="number" min="1" max="200" step="1"
            style={{ width: 110 }} value={aiConfig.radiusKm}
            onChange={(e) => setAiConfig((v) => ({ ...v, radiusKm: e.target.value }))} />
          <button type="button" className="btn btn-secondary btn-sm" disabled={aiBusy}
            onClick={() => saveAiConfig(aiConfig)}>Enregistrer le rayon</button>
        </div>
        <label className="small font-semibold" htmlFor="ai-rate">Cadence des simulations automatiques</label>
        <div className="flex items-center gap-3 mt-2 mb-3">
          <input id="ai-rate" className="input" type="number" min="0.001" step="any"
            style={{maxWidth:260}} value={aiConfig.testsPerSecond ?? 0.2}
            onChange={(e) => setAiConfig(v => ({...v, testsPerSecond: e.target.value}))} />
          <span className="small muted">simulations / seconde demandées</span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={aiBusy}
            onClick={() => saveAiConfig(aiConfig)}>Enregistrer la cadence</button>
        </div>
        <p className="tiny muted mb-3">Objectif libre (ex. 1000/s), mais le moteur actuel exécute au maximum 1 requête à la fois, avec un intervalle minimal de 1 seconde. Un objectif de 1000/s ne signifie pas 1000 requêtes réellement envoyées.</p>
        <div className="flex gap-2 flex-wrap mb-3">
          <button type="button" className="btn btn-primary btn-sm" disabled={aiBusy || aiConfig.enabled}
            onClick={() => saveAiConfig({ ...aiConfig, enabled: true })}>Démarrer la collecte</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={aiBusy || !aiConfig.enabled}
            onClick={() => saveAiConfig({ ...aiConfig, enabled: false })}>Arrêter</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={aiInFlight.current || !aiConfig.enabled}
            onClick={sampleAi}>Tester une fois</button>
        </div>
        <p className="small">Observations enregistrées : <strong>{aiStats.count}</strong></p>
        {aiConfig.stopReason && !aiConfig.enabled && <p role="alert" className="small mt-2" style={{ color: "#ef4444" }}>Arrêt automatique : {aiConfig.stopReason}</p>}
        {aiResult && <p className="tiny muted mt-2">
          {aiResult.ok ? `${aiResult.saved} prix enregistrés · ${aiResult.pickup} → ${aiResult.dropoff}` :
            `Dernier test : ${aiResult.error || aiResult.skipped || "échec"}`}
        </p>}
        <p className="tiny muted mt-2">
          Le mode intensif fonctionne tant que cette page admin reste ouverte et visible. Les trajets utilisent des adresses françaises réelles avec numéro de rue, dans le rayon choisi. Chaque adresse aléatoire est réservée une seule fois en base. La cohorte horaire reste indépendante.
          Les refus et limitations du fournisseur peuvent interrompre les tests.
        </p>
        <div className="mt-4" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <strong className="small">Prévision expérimentale UberX</strong>
          <div className="flex items-center gap-2 mt-2">
            <input className="input" type="number" min="1" max="500" value={aiPredictionDistance}
              style={{ width: 100 }} onChange={(e) => setAiPredictionDistance(e.target.value)} />
            <span className="small">km</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={predictAi}>Prévoir</button>
          </div>
          {aiPrediction && <p className="small mt-2">
            {aiPrediction.ready ? `Estimation : ${aiPrediction.price.toFixed(2)} € (${aiPrediction.samples} observations proches)` :
              `Données insuffisantes : ${aiPrediction.samples} observations proches (minimum 10)`}
          </p>}
        </div>
      </div>

      <div className="card card-pad mb-5">
        <h3 style={{fontSize:"1.15rem",marginBottom:8}}>Source des prix proposés aux clients</h3>
        <p className="small muted mb-3">Choisis la source utilisée pour calculer les tarifs. Le mode automatique privilégie Uber puis bascule sur ton modèle IA si une catégorie Uber n'est plus disponible.</p>
        <div className="flex gap-2 flex-wrap mb-3">
          {[["auto","Automatique · Uber → IA"],["uber","Uber uniquement"],["ai","IA uniquement"]].map(([mode,label])=>(
            <button type="button" key={mode}
              className={`btn btn-sm ${pricingSource===mode?"btn-primary":"btn-secondary"}`}
              disabled={sourceSaving} onClick={()=>savePricingSource(mode)}>{label}</button>
          ))}
        </div>
        <p className="tiny muted">
          {pricingSource==="auto"?"Uber est prioritaire. Si le cookie expire ou si Uber ne fournit plus de prix, le modèle IA prend le relais par catégorie.":
           pricingSource==="uber"?"Seuls les tarifs Uber sont utilisés. Sans prix Uber, aucun tarif n'est inventé.":
           "Les tarifs sont calculés uniquement à partir des observations Uber enregistrées, sans nouvelle requête Uber pour le devis."}
        </p>
        <p className="tiny muted mt-2">Si l'IA manque de données pour une catégorie, cette catégorie ne peut pas être tarifée. La grille fixe de secours a été retirée.</p>
      </div>

      <UberBenchmarkChart />
      <UberAnalytics observations={aiStats.recent || []} total={aiStats.count || 0} onRefresh={() => Promise.all([loadAiStatus(), loadAllAiObservations()]).catch(() => toast("Actualisation impossible", "error"))} />
      <div className="card card-pad mb-5">
        <h3 style={{fontSize:"1.15rem",marginBottom:8}}>Comparer Uber et l’algorithme IA en temps réel</h3>
        <p className="small muted mb-3">Chaque comparaison utilise une paire unique du réservoir de 9 000 trajets, classée selon la distance réelle en voiture Google Maps (500 m à 9 km). Constitue d’abord le réservoir dans le Laboratoire. Comparaison sans remise StrasDrive ni réservation client.</p>
        <button type="button" className="btn btn-primary btn-sm" disabled={comparisonBusy || autoCompare} onClick={()=>comparePrices(false)}>
          {comparisonBusy ? "Comparaison en cours…" : "Tester un trajet du réservoir"}
        </button>
        <button type="button" className={`btn btn-sm ${autoCompare?"btn-secondary":"btn-primary"}`} style={{marginLeft:8}} onClick={()=>{setAutoCompare(v=>!v);setBulkTarget(false);setBulkDeadline(null);setComparisonMaxKm(9);}}>
          {autoCompare?"Arrêter le test automatique":"Démarrer le test automatique"}
        </button>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button type="button" className="btn btn-primary btn-sm"
            disabled={autoCompare || comparisonBusy}
            onClick={() => {
              setComparisonMaxKm(9);
              setAutoStats({tested:0,saved:0,errors:0});
              setBulkMessage("");
              setBulkDeadline(Date.now()+10*60*1000);
              setBulkTarget(true);
              setAutoCompare(true);
            }}>Collecter 100 000 estimations Uber (10 min)</button>
          {bulkTarget && <button type="button" className="btn btn-secondary btn-sm"
            onClick={() => {setAutoCompare(false);setBulkTarget(false);setBulkMessage("Collecte arrêtée manuellement.");}}>Arrêter les 100 000</button>}
        </div>
        {bulkTarget && <div className="mt-2">
          <p className="small">Objectif : <strong>{autoStats.saved.toLocaleString("fr-FR")} / 100 000</strong> estimations enregistrées</p>
          <progress value={Math.min(100000,autoStats.saved)} max={100000} style={{width:"100%"}} />
          <p className="tiny muted">Fenêtre de 10 minutes, collecte séquentielle et limitée par la disponibilité d'Uber. Le total atteint peut être inférieur à l'objectif.</p>
        </div>}
        {bulkMessage && <p role="status" className="small mt-2">{bulkMessage}</p>}
        <p className="small muted mt-2">Mode automatique : trajets de 9 km maximum, jusqu'à 10 lancements par seconde selon les délais réseau, sans requêtes simultanées. Tous les prix Uber réels des trajets de 9 km maximum sont enregistrés, quel que soit l’écart avec l’IA. Les prédictions IA ne sont jamais enregistrées comme prix d’apprentissage. Fonctionne uniquement pendant que cette page est ouverte et visible.</p>
        <p className="small mt-2">Tests terminés : <strong>{autoStats.tested}</strong> · Tarifs Uber enregistrés : <strong>{autoStats.saved}</strong> · Erreurs : <strong>{autoStats.errors}</strong></p>
        {priceComparison?.error && <p role="alert" className="small mt-3" style={{color:"#ef4444"}}>{priceComparison.error}</p>}
        {priceComparison?.comparisons && (
          <div className="mt-4">
            <p className="small"><strong>Départ :</strong> {priceComparison.pickup}</p>
            <p className="small"><strong>Arrivée :</strong> {priceComparison.dropoff}</p>
            <p className="small muted">{priceComparison.distanceKm} km à vol d'oiseau · {new Date(priceComparison.comparedAt).toLocaleString("fr-FR")}</p>
            <div style={{overflowX:"auto",marginTop:12}}>
              <table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}>
                <thead><tr><th>Catégorie</th><th>Uber</th><th>Algorithme IA</th><th>Écart IA − Uber</th></tr></thead>
                <tbody>
                  {priceComparison.comparisons.map((item,i)=>(
                    <tr key={item.category+"-"+i} style={{borderTop:"1px solid var(--border)"}}>
                      <td>{item.category}</td>
                      <td>{item.uberPrice.toFixed(2)} €</td>
                      <td>{item.ready ? item.aiPrice.toFixed(2)+" €" : "Données insuffisantes"}</td>
                      <td>{item.ready ? `${item.differenceEur>0?"+":""}${item.differenceEur.toFixed(2)} € (${item.differencePct>0?"+":""}${item.differencePct.toFixed(2)} %)` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny muted mt-3">{priceComparison.note}</p>
          </div>
        )}
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
