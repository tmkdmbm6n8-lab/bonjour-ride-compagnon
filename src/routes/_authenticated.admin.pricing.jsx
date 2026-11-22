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
  const [addressProvider, setAddressProvider] = useState("auto");
  const [addressSaving, setAddressSaving] = useState(false);
  const [savingType, setSavingType] = useState(null);

  // État de la réduction Uber
  const [uberDiscount, setUberDiscount] = useState({ enabled: true, ratePct: 20 });
  const [savingUber, setSavingUber] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [showCookieBox, setShowCookieBox] = useState(false);
  const [savingCookie, setSavingCookie] = useState(false);
  const [cookieStatus, setCookieStatus] = useState(null);
  const [sessionMonitor, setSessionMonitor] = useState({state:"idle",startedAt:null,endedAt:null,durationMs:null,failures:0});
  const [sessionProbeLog, setSessionProbeLog] = useState([]);
  const [sessionHistoryReady, setSessionHistoryReady] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  useEffect(() => {
    try {
      const checks = JSON.parse(localStorage.getItem("strasdrive_uber_checks_v1") || "[]");
      if (Array.isArray(checks)) setSessionProbeLog(checks.filter(x => x && x.status !== "pending").slice(0, 500));
      const sessions = JSON.parse(localStorage.getItem("strasdrive_uber_sessions_v1") || "[]");
      if (Array.isArray(sessions)) setSessionHistory(sessions.slice(0, 100));
    } catch {}
    setSessionHistoryReady(true);
  }, []);
  useEffect(() => {
    if (!sessionHistoryReady) return;
    try { localStorage.setItem("strasdrive_uber_checks_v1", JSON.stringify(sessionProbeLog.filter(x => x.status !== "pending").slice(0, 500))); } catch {}
  }, [sessionProbeLog, sessionHistoryReady]);
  useEffect(() => {
    if (!sessionHistoryReady) return;
    try { localStorage.setItem("strasdrive_uber_sessions_v1", JSON.stringify(sessionHistory.slice(0, 100))); } catch {}
  }, [sessionHistory, sessionHistoryReady]);
  function saveSessionEnd(status, endedAt) {
    const startedAt = sessionMonitorRef.current.startedAt;
    if (!startedAt) return;
    setSessionHistory(prev => [{startedAt, endedAt, durationMs: Math.max(0, endedAt-startedAt), status}, ...prev].slice(0, 100));
  }
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const sessionMonitorBusy = useRef(false);
  const sessionMonitorRef = useRef({startedAt:null,failures:0,active:false});
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
      if (automatic && data.skipped === "9 000 trajets terminés") setAutoCompare(false);
      if (automatic && !data.skipped) setAutoStats(prev=>({...prev,tested:prev.tested+1,saved:prev.saved+(Number(data.savedCount)||0)}));
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

  async function saveAddressProvider(provider) {
    setAddressSaving(true);
    try {
      const res = await fetch("/api/admin/address-search-provider", {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider})});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible");
      setAddressProvider(data.provider);
      toast("API de recherche enregistrée", "success");
    } catch (error) { toast(error.message || "Impossible de changer l'API", "error"); }
    finally { setAddressSaving(false); }
  }
  useEffect(() => {
    let active=true;
    fetch("/api/admin/address-search-provider").then(r=>r.json()).then(data=>{
      if(active && ["auto","osm","google"].includes(data.provider)) setAddressProvider(data.provider);
    }).catch(()=>{});
    return ()=>{active=false};
  },[]);
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
        const startedAt=Date.now();
        sessionMonitorRef.current={startedAt,failures:0,active:true};
        setSessionMonitor({state:"active",startedAt,endedAt:null,durationMs:null,failures:0});
        setMonitorEnabled(true);
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

  // A successful Uber price response is a heartbeat, not proof that the cookie
  // remains valid until the next check. Two failed probes avoid false alarms
  // from a single network interruption.
  useEffect(() => {
    if(!monitorEnabled || sessionMonitor.state!=="active")return;
    let cancelled=false;
    async function probe(){
      if(sessionMonitorBusy.current||!sessionMonitorRef.current.active)return;
      sessionMonitorBusy.current=true;
      const sentAt=Date.now();
      setSessionProbeLog(prev=>[{id:sentAt,at:sentAt,status:"pending",detail:"Requête envoyée",duration:null},...prev].slice(0,500));
      const recordProbe=(status,detail,diagnostic=null)=>setSessionProbeLog(prev=>prev.map(entry=>entry.id===sentAt?{...entry,status,detail,diagnostic,duration:Date.now()-sentAt}:entry));
      try{
        const res=await fetch("/api/admin/pricing",{
          method:"PUT",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({vehicleType:"uber_hourly_check_now"})
        });
        const data=await res.json();
        if(cancelled)return;
        recordProbe(res.ok&&data.ok?"ok":"error",res.ok?(data.ok?"Réponse Uber valide":"Aucun prix Uber valide"):`HTTP ${res.status}`,data?.diagnostic||null);
        if(res.ok&&data.ok){
          sessionMonitorRef.current.failures=0;
          setSessionMonitor(prev=>({...prev,failures:0}));
        }else{
          sessionMonitorRef.current.failures+=1;
          if(sessionMonitorRef.current.failures>=2){
            const endedAt=Date.now();
            const durationMs=endedAt-sessionMonitorRef.current.startedAt;
            sessionMonitorRef.current.active=false;
            saveSessionEnd("Signal perdu",endedAt);
            setSessionMonitor({state:"lost",startedAt:sessionMonitorRef.current.startedAt,endedAt,durationMs,failures:2});
            toast("Signal Uber perdu : durée de session "+Math.floor(durationMs/60000)+" min "+Math.floor(durationMs%60000/1000)+" s","error",10000);
          }else setSessionMonitor(prev=>({...prev,failures:1}));
        }
      }catch(error){
        if(!cancelled){
          recordProbe("error",error?.message||"Erreur réseau");
          sessionMonitorRef.current.failures+=1;
          if(sessionMonitorRef.current.failures>=2){
            const endedAt=Date.now(),durationMs=endedAt-sessionMonitorRef.current.startedAt;
            sessionMonitorRef.current.active=false;
            saveSessionEnd("Signal perdu",endedAt);
            setSessionMonitor({state:"lost",startedAt:sessionMonitorRef.current.startedAt,endedAt,durationMs,failures:2});
            toast("Signal Uber perdu ou réseau indisponible : durée observée "+Math.floor(durationMs/60000)+" min "+Math.floor(durationMs%60000/1000)+" s","error",10000);
          }
        }
      }finally{sessionMonitorBusy.current=false;}
    }
    probe();
    const timer=setInterval(probe,600000);
    return ()=>{cancelled=true;clearInterval(timer);};
  },[monitorEnabled,sessionMonitor.state,sessionMonitor.startedAt]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/pricing");
        const data = await res.json();
        if (ignore || !res.ok) return;

        if (data.uberCookieStatus) {
          setCookieStatus(data.uberCookieStatus);
          // Resume monitoring an already saved cookie after page reload.
          // Duration is measured from the first observation in this browser tab,
          // not from the original Uber login or cookie creation.
          if (data.uberCookieStatus.hasCustomCookie && monitorEnabled && !sessionMonitorRef.current.active) {
            const startedAt = Date.now();
            sessionMonitorRef.current = { startedAt, failures: 0, active: true };
            setSessionMonitor({ state: "active", startedAt, endedAt: null, durationMs: null, failures: 0 });
          }
        }
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
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="small">Requêtes automatiques de surveillance Uber (10 minutes)</span>
          <button type="button" className={monitorEnabled?"btn btn-secondary btn-sm":"btn btn-primary btn-sm"} aria-pressed={monitorEnabled}
            onClick={()=>{
              if(monitorEnabled){
                saveSessionEnd("Arrêt manuel",Date.now());
                setMonitorEnabled(false);
                sessionMonitorRef.current.active=false;
                setSessionMonitor(prev=>({...prev,state:"idle",failures:0}));
              }else{
                const startedAt=Date.now();
                sessionMonitorRef.current={startedAt,failures:0,active:true};
                setSessionMonitor({state:"active",startedAt,endedAt:null,durationMs:null,failures:0});
                setMonitorEnabled(true);
              }
            }}>
            {monitorEnabled?"Désactiver les requêtes":"Activer les requêtes"}
          </button>
        </div>
        {!monitorEnabled && <p className="tiny muted mb-2">Surveillance arrêtée : aucune nouvelle requête de contrôle automatique n'est lancée par cette page. Les estimations des clients restent disponibles.</p>}
        {sessionMonitor.state==="idle" && <p className="small mt-2 muted" role="status">Voyant en attente : aucune session Uber personnalisée surveillée. Enregistrez un cookie pour démarrer les vérifications.</p>}
        {sessionMonitor.state==="active" && <div className="small mt-2 flex items-center gap-2" role="status" aria-live="polite">
          <span aria-hidden="true" style={{display:"inline-block",width:12,height:12,borderRadius:"50%",background:sessionMonitor.failures>0?"#f59e0b":"#22c55e",boxShadow:sessionMonitor.failures>0?"0 0 0 3px #f59e0b30":"0 0 0 3px #22c55e30",flexShrink:0}} />
          <span><strong style={{color:sessionMonitor.failures>0?"#d97706":"#16a34a"}}>{sessionMonitor.failures>0?"Signal incertain":"Signal Uber actif"}</strong> · vérification toutes les 10 minutes.{sessionMonitor.failures>0?" Première vérification sans réponse valide.":""}</span>
        </div>}
        {sessionMonitor.state==="lost" && <div className="small mt-2 flex items-start gap-2" role="alert" style={{color:"#ef4444"}}>
          <span aria-hidden="true" style={{display:"inline-block",width:12,height:12,marginTop:3,borderRadius:"50%",background:"#ef4444",boxShadow:"0 0 0 3px #ef444430",flexShrink:0}} />
          <span><strong>Signal Uber perdu</strong> · durée observée : <strong>{Math.floor(sessionMonitor.durationMs/3600000)} h {Math.floor(sessionMonitor.durationMs%3600000/60000)} min {Math.floor(sessionMonitor.durationMs%60000/1000)} s</strong>.
          <span className="block">Dernier constat de perte : {sessionMonitor.endedAt ? new Date(sessionMonitor.endedAt).toLocaleString("fr-FR") : "—"}. La perte peut aussi provenir du réseau ou du serveur.</span></span>
        </div>}
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <strong className="small">Historique des sessions Uber</strong>
            <button type="button" className="btn btn-secondary btn-xs" onClick={()=>setSessionHistory([])}>Effacer</button>
          </div>
          <p className="tiny muted">Durée de surveillance observée, pas durée de validité garantie du cookie. Historique conservé sur cet appareil.</p>
          <div style={{maxHeight:180,overflowY:"auto",fontSize:12}}>
            {sessionHistory.length===0 && <p className="tiny muted">Aucune session terminée enregistrée.</p>}
            {sessionHistory.map((entry,i)=><div key={entry.startedAt+"-"+i} style={{padding:"5px 0",borderBottom:"1px solid var(--border, #333)"}}>
              {new Date(entry.startedAt).toLocaleString("fr-FR")} → {new Date(entry.endedAt).toLocaleString("fr-FR")} · {entry.status} · {Math.floor(entry.durationMs/3600000)} h {Math.floor(entry.durationMs%3600000/60000)} min {Math.floor(entry.durationMs%60000/1000)} s
            </div>)}
          </div>
        </div>
        <div className="mt-3" style={{borderTop:"1px solid var(--border, #333)",paddingTop:12}}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <strong className="small">Journal des requêtes Uber (toutes les 10 minutes)</strong>
            <button type="button" className="btn btn-secondary btn-xs" onClick={()=>setSessionProbeLog([])}>Effacer</button>
          </div>
          <p className="tiny muted mb-2">Les 500 dernières vérifications sont conservées dans ce navigateur, même après actualisation. Le statut HTTP, le code GraphQL, le nombre de prix et les durées sont affichés sans révéler le cookie. Aucune requête ne se chevauche.</p>
          <div role="log" aria-live="off" style={{maxHeight:210,overflowY:"auto",fontFamily:"monospace",fontSize:12}}>
            {sessionProbeLog.length===0 && <p className="tiny muted">Aucune requête enregistrée dans ce navigateur.</p>}
            {sessionProbeLog.map(entry=>(
              <div key={entry.id} style={{padding:"5px 0",borderBottom:"1px solid var(--border, #333)",color:entry.status==="ok"?"#22c55e":entry.status==="error"?"#ef4444":"#f59e0b"}}>
                <div>{new Date(entry.at).toLocaleString("fr-FR")} · {entry.status==="ok"?"✓ OK":entry.status==="error"?"✕ ÉCHEC":"… EN COURS"} · {entry.detail}</div>
                <div style={{color:"var(--muted-foreground, #999)",paddingLeft:12,whiteSpace:"normal",lineHeight:1.6}}>
                  {entry.diagnostic ? <>
                    Source : {entry.diagnostic.source || "Uber"} · HTTP : {entry.diagnostic.httpStatus ?? "non reçu"} · GraphQL : {entry.diagnostic.graphqlCode || (entry.status==="ok"?"OK":"inconnu")}<br/>
                    Prix reçus : {entry.diagnostic.priceCount ?? 0} · Durée Uber : {entry.diagnostic.durationMs ?? "?"} ms · Durée totale : {entry.duration ?? "?"} ms<br/>
                    {entry.diagnostic.graphqlMessage ? `Message : ${entry.diagnostic.graphqlMessage} · ` : ""}{entry.diagnostic.error ? `Diagnostic : ${entry.diagnostic.error}` : ""}
                  </> : <>Durée : {entry.duration ?? "?"} ms · Diagnostic détaillé indisponible pour cet ancien contrôle</>}
                </div>
              </div>
            ))}
          </div>
        </div>
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
            <p className="tiny muted">Campagne fixe : 4 rue de la Marquise de Sévigné, Strasbourg → 10 trajets par tranche de 0,5 km, de 1 à 100 km (1 990 trajets). Arrêt automatique à la fin. Gardez cette page ouverte.</p>
          </div>
          <span className={`badge ${aiConfig.enabled ? "badge-success" : "badge-neutral"}`}>
            {aiConfig.enabled ? "Collecte active" : "À l'arrêt"}
          </span>
        </div>
        <label className="small font-semibold" htmlFor="ai-radius">Rayon historique (sans effet sur la collecte fixe)</label>
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
        <p className="tiny muted mb-3">Une seule requête à la fois, avec un intervalle minimal de 1 seconde. Les recherches d’adresses et les distances routières peuvent prendre davantage de temps. Une tranche difficile à trouver sera réessayée.</p>
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

      <div className="card card-pad mb-5">
        <h3 style={{fontSize:"1.15rem",marginBottom:8}}>API de recherche d'adresses</h3>
        <p className="small muted mb-3">Choisis le service de recherche pour les adresses de départ et d'arrivée. Le calcul des itinéraires reste inchangé.</p>
        <div className="flex gap-2 flex-wrap">
          {[["osm","OSM (OpenStreetMap)"],["google","Google Maps"]].map(([provider,label])=>(
            <button type="button" key={provider} className={addressProvider===provider?"btn btn-sm btn-primary":"btn btn-sm btn-secondary"}
              disabled={addressSaving} onClick={()=>saveAddressProvider(provider)}>{label}</button>
          ))}
        </div>
        <p className="tiny muted mt-2">{addressProvider==="google"?"Google Maps nécessite une clé API et un quota disponibles.":"OSM utilise Géoplateforme et Photon/OpenStreetMap."}</p>
      </div>

      <UberBenchmarkChart />
      <UberAnalytics observations={aiStats.recent || []} total={aiStats.count || 0} onRefresh={() => Promise.all([loadAiStatus(), loadAllAiObservations()]).catch(() => toast("Actualisation impossible", "error"))} />
      <div className="card card-pad mb-5">
        <h3 style={{fontSize:"1.15rem",marginBottom:8}}>Comparer Uber et l’algorithme IA en temps réel</h3>
        <p className="small muted mb-3">Un trajet aléatoire entre deux adresses numérotées réelles est recherché à chaque clic. Choisis un petit trajet (maximum 9 km) ou un grand trajet (maximum 100 km). Comparaison par catégorie, sans appliquer la remise StrasDrive. Chaque adresse testée est réservée définitivement pour ne jamais être réutilisée. Aucune réservation client n’est créée.</p>
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <span className="small font-semibold">Distance maximale :</span>
          <button type="button" className={`btn btn-sm ${comparisonMaxKm===9?"btn-primary":"btn-secondary"}`} disabled={comparisonBusy} onClick={()=>setComparisonMaxKm(9)}>Petit trajet · 9 km</button>
          <button type="button" className={`btn btn-sm ${comparisonMaxKm===100?"btn-primary":"btn-secondary"}`} disabled={comparisonBusy} onClick={()=>setComparisonMaxKm(100)}>Grand trajet · 100 km</button>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={comparisonBusy || autoCompare} onClick={()=>comparePrices(false)}>
          {comparisonBusy ? "Comparaison en cours…" : "Tester un trajet aléatoire"}
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
