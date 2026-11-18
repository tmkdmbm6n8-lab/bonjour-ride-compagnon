import DriverPageClose from "@/components/driver/DriverPageClose";
import { createFileRoute } from "@tanstack/react-router";
import DriverLayout from "@/components/DriverLayout";
import { apiFetch as fetch } from "@/lib/archive-fetch";
import { useEffect, useState } from "react";
import { Check, UserRound, Armchair, PawPrint, Users, Navigation, SlidersHorizontal, Car } from "lucide-react";
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

function PreferencesPage() {
  const toast = useToast();
  const [driver, setDriver] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null);
  const [section, setSection] = useState("services");
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
    <div className="driver-tab-page sd-preferences">
      <header className="driver-account-heading"><div><span className="sd-settings-brand">StrasDrive · Votre conduite</span><h1>Préférences de course</h1></div><DriverPageClose label="Fermer les préférences" /></header>
      <p className="sd-settings-intro">Composez votre journée à votre façon.</p>
      <div className="sd-settings-navigation" role="tablist" aria-label="Sections des préférences">
        {[
          ['services','Services',Car],['criteria','Critères',SlidersHorizontal],['navigation','GPS',Navigation],
        ].map(([id,label,Icon],index)=><button key={id} id={`settings-tab-${id}`} type="button" role="tab" aria-selected={section===id} aria-controls={`settings-panel-${id}`} onClick={()=>setSection(id)}><Icon size={19}/><span>{label}</span><small>0{index+1}</small></button>)}
      </div>
      {failed ? <p className="driver-notice" role="alert">Impossible de charger vos préférences. Réouvrez cette page pour réessayer.</p> : !driver ? <p className="muted">Chargement de votre configuration…</p> : <>
        {section==='services' && <section className="sd-settings-panel" id="settings-panel-services" role="tabpanel" aria-labelledby="settings-tab-services">
          <span className="sd-settings-kicker">01 · Vos services</span><h2>Les courses qui vous correspondent</h2>
          <p>Votre gamme reste active. Vous choisissez les gammes supplémentaires accessibles à votre véhicule.</p>
          <div className="sd-primary-service"><Car size={26}/><div><strong>{VEHICLE_LABELS[own]}</strong><span>Votre gamme principale</span></div><span className="sd-service-status"><Check size={15}/>Active</span></div>
          <div className="sd-service-list">{lower.map(cls=>{
            const Icon=CLASS_ICONS[cls]||UserRound;const on=accepted.includes(cls);
            return <label className={`sd-service-choice ${on?'selected':''}`} key={cls}><Icon size={22}/><span><strong>{VEHICLE_LABELS[cls]}</strong><small>Payée au tarif {VEHICLE_LABELS[cls]}</small></span><input type="checkbox" checked={on} disabled={busy!==null} onChange={()=>toggleClass(cls)}/></label>;
          })}</div>
          {lower.length===0&&<p className="sd-settings-note">Votre véhicule reçoit uniquement les courses de sa gamme.</p>}
        </section>}
        {section==='criteria' && <section className="sd-settings-panel" id="settings-panel-criteria" role="tabpanel" aria-labelledby="settings-tab-criteria">
          <span className="sd-settings-kicker">02 · Vos critères</span><h2>Affinez les demandes reçues</h2><p>Des réglages simples, applicables à vos prochaines propositions de course.</p>
          <label className="sd-cash-choice"><span><strong>Accepter les espèces</strong><small>Recevoir aussi les courses réglées en espèces.</small></span><input type="checkbox" checked={prefs.acceptCash} disabled={busy!==null} onChange={()=>setPrefs('cash',{acceptCash:!prefs.acceptCash},prefs.acceptCash?'Vous ne recevrez plus les courses payées en espèces':'Courses en espèces acceptées')}/></label>
          <label className="sd-settings-field"><strong>Note minimale du passager</strong><select className="input" value={prefs.minRiderRating??''} disabled={busy!==null} onChange={event=>setPrefs('rating',{minRiderRating:event.target.value===''?null:Number(event.target.value)})}><option value="">Sans filtre de note</option>{MIN_RIDER_RATING_OPTIONS.map(value=><option value={value} key={value}>{num(value,1)} étoiles ou plus</option>)}</select><small>Les nouveaux passagers ayant moins de 3 notes restent visibles.</small></label>
          <label className="sd-settings-field"><strong>Gain minimum par kilomètre</strong><select className="input" value={prefs.minPayPerKm??''} disabled={busy!==null} onChange={event=>setPrefs('pay',{minPayPerKm:event.target.value===''?null:Number(event.target.value)})}><option value="">1,00 €/km (minimum garanti)</option>{MIN_PAY_PER_KM_OPTIONS.map(value=><option value={value} key={value}>{num(value)} €/km ou plus</option>)}</select><small>Gain net, approche comprise. Un minimum plus élevé réduit le nombre de demandes reçues.</small></label>
          {isFiltering(prefs)&&<p className="sd-settings-note">Vos critères personnalisés sont actifs.</p>}
        </section>}
        {section==='navigation' && <section className="sd-settings-panel" id="settings-panel-navigation" role="tabpanel" aria-labelledby="settings-tab-navigation">
          <span className="sd-settings-kicker">03 · Votre navigation</span><h2>Votre GPS, prêt au départ</h2><p>Choisissez l’application à ouvrir lorsque vous appuyez sur « Démarrer le trajet ».</p>
          <div className="sd-gps-choices" role="radiogroup" aria-label="Application GPS préférée">{Object.entries(NAV_APPS).map(([id,label])=><button key={id} type="button" role="radio" aria-checked={navApp===id} className={navApp===id?'selected':''} onClick={()=>chooseNavApp(id)}><span className="sd-gps-emblem"><Navigation size={22}/></span><span>{label}</span><span className="sd-gps-check">{navApp===id&&<Check size={18}/>}</span></button>)}</div>
          <button className="sd-gps-reset" type="button" onClick={()=>chooseNavApp(null)}>Me demander à chaque trajet</button>
          <p className="sd-settings-note">{navApp?'Le GPS choisi s’ouvrira directement au démarrage du trajet.':'Les trois applications vous seront proposées au démarrage du trajet.'}</p>
        </section>}
        <p className="sd-settings-save" role="status">{busy?'Enregistrement en cours…':'Vos choix sont enregistrés automatiquement.'}</p>
      </>}
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
