import { useState, useRef, useEffect } from "react";
import { UserCircle, LayoutDashboard, Mail, FileText, Users, Car, ChartColumn, Wallet, MapPin, Settings } from "lucide-react";
import MapView from "@/components/maps/MapView";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/archive-auth";

const pages = [["Accueil", LayoutDashboard],["Chauffeurs", Users],["Véhicules", Car],["Carte en direct", MapPin],["Performances", ChartColumn],["Revenus", Wallet],["Messagerie", Mail],["Documents", FileText],["Compte société", Settings]];
const docTypes = ["Assurance professionnelle","Registre VTC","Justificatif d’entreprise"];
const money = value => Number(value).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
const today = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const center = {lat:48.583,lng:7.747};
async function desk(action,p={}) {
  const {data,error} = await supabase.rpc("sd_fleet_desk",{action,p});
  if(error) throw Error(error.message);
  return data;
}
export default function FleetManager({fleet,act,busy,submit}) {
  const [page,setPage]=useState("Accueil"), [menu,setMenu]=useState(false);
  const [query,setQuery]=useState(""), [filter,setFilter]=useState("Tous");
  const [from,setFrom]=useState(today), [to,setTo]=useState(today), [rows,setRows]=useState(null);
  const [info,setInfo]=useState(null), [error,setError]=useState(""), [revision,reload]=useState(0);
  const profile=useRef(null), dialog=useRef(null);
  useEffect(()=>{if(menu) dialog.current?.showModal();},[menu]);
  function go(next,f="Tous"){setPage(next);setFilter(f);setQuery("");setMenu(false);setError("");}
  useEffect(()=>{
    let live=true;
    async function load(){try{const result=await desk("view");if(live)setInfo(result);}catch(e){if(live)setError(e.message);}}
    load();const timer=setInterval(load,15000);return ()=>{live=false;clearInterval(timer);};
  },[revision]);
  useEffect(()=>{
    if(!["Performances","Revenus"].includes(page))return;
    let live=true;setRows(null);setError("");
    desk("report",{from,to}).then(r=>{if(live)setRows(r);}).catch(e=>{if(live)setError(e.message);});
    return ()=>{live=false;};
  },[page,from,to,fleet.today.count]);
  async function execute(fn){try{setError("");await fn();reload(n=>n+1);}catch(e){setError(e.message);}}
  function upload(e,kind){
    e.preventDefault();const form=e.currentTarget, data=new FormData(form),file=data.get("file");
    execute(async()=>{
      if(file.size>2*1024*1024)throw Error("Choisissez un PDF de 2 Mo maximum.");
      const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(Error("Lecture du PDF impossible"));reader.readAsDataURL(file);});
      await desk("upload",{kind,name:file.name,file:encoded,expiry:data.get("expiry")});form.reset();
    });
  }
  async function download(kind){
    const d=await desk("download",{kind});if(!d)throw Error("Document indisponible");
    const blob=new Blob([Uint8Array.from(atob(d.file),c=>c.charCodeAt(0))],{type:"application/pdf"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=d.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  const drivers=fleet.drivers,vehicles=fleet.vehicles,online=drivers.filter(d=>d.online);
  const assigned=id=>vehicles.find(v=>v.driver===id);
  const match=s=>s.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"));
  const toolbar=(placeholder,options)=> <div className="fleet-tools"><input className="input" aria-label={placeholder} placeholder={placeholder} value={query} onChange={e=>setQuery(e.target.value)}/><select className="input" aria-label="Filtrer" value={filter} onChange={e=>setFilter(e.target.value)}>{options.map(o=><option key={o}>{o}</option>)}</select></div>;
  const list=drivers.filter(d=>match(d.name+" "+(assigned(d.id)?.plate||"")) && (filter==="Tous" || (filter==="Invitations"&&!d.accepted)||(filter==="En ligne"&&d.online)||(filter==="Hors ligne"&&d.accepted&&!d.online)||(filter==="Sans véhicule"&&d.accepted&&!assigned(d.id))));
  const cars=vehicles.filter(v=>match(v.model+" "+v.plate) && (filter==="Tous" || (filter==="Disponibles"?!v.taken:v.taken)));
  const markers=online.filter(d=>d.location && match(d.name+" "+(assigned(d.id)?.plate||"")));
  const alerts=info?docTypes.filter(k=>{const d=info.files.find(f=>f.kind===k);return !d||d.review==="Refusé"||(d.expiry&&d.expiry<today());}).length:0;
  const news=info?.news.filter(n=>filter!=="Non lus"||!n.read_at)||[];
  const report=rows||[], gross=report.reduce((s,r)=>s+Number(r.gross),0),net=report.reduce((s,r)=>s+Number(r.net),0);
  const groups=new Map();
  for(const r of report){const byCar=page==="Performances"&&filter==="Véhicules",key=byCar?r.vehicle:r.driver_id;
    const g=groups.get(key)||{label:byCar?r.vehicle:r.driver,trips:0,net:0,hours:0};g.hours+=Number(r.hours||0);g.trips+=Number(r.trips);g.net+=Number(r.net);groups.set(key,g);}
  return <div className="fleet-desk">
    <header><div><small>{fleet.name}</small><h1>{page}</h1></div><button ref={profile} className="fleet-profile" aria-label="Ouvrir le menu de la flotte" onClick={()=>setMenu(true)}><UserCircle size={28}/></button></header>
    {menu&&<dialog ref={dialog} className="fleet-dialog brand-theme" aria-label="Navigation de la flotte" onClose={()=>{setMenu(false);profile.current?.focus();}} onClick={e=>{if(e.target===dialog.current)dialog.current.close();}}>
      <div className="flex items-center justify-between"><strong>{fleet.name}</strong><button className="btn btn-secondary btn-sm" onClick={()=>dialog.current.close()}>Fermer</button></div>
      <nav>{pages.map(([name,Icon])=><button aria-current={name===page?"page":undefined} key={name} onClick={()=>{dialog.current.close();go(name);}}><Icon size={19}/>{name}</button>)}</nav></dialog>}
    {error&&<p role="alert" className="input-error-msg">{error}</p>}
    {page==="Accueil"&&<>
      <section className="fleet-hero"><small>Revenus chauffeurs aujourd’hui</small><strong>{money(fleet.today.net)}</strong><button onClick={()=>go("Revenus")}>{fleet.today.count} courses terminées →</button></section>
      <div className="fleet-metrics">{[[online.length,"En ligne","Chauffeurs","En ligne"],[drivers.filter(d=>d.accepted&&!d.online).length,"Hors ligne","Chauffeurs","Hors ligne"],[vehicles.filter(v=>!v.taken).length,"Véhicules disponibles","Véhicules","Disponibles"]].map(([n,label,target,f])=><button key={label} onClick={()=>go(target,f)}><b>{n}</b>{label}</button>)}</div>
      <section className="card card-pad"><h2>À suivre</h2><button className="fleet-row" onClick={()=>go("Documents")}>Documents à compléter ou renouveler<strong>{info?alerts:"…"}</strong></button><button className="fleet-row" onClick={()=>go("Chauffeurs","Invitations")}>Invitations en attente<strong>{drivers.filter(d=>!d.accepted).length}</strong></button></section>
    </>}
    {page==="Chauffeurs"&&<><details className="card card-pad"><summary>Inviter un chauffeur</summary><form className="flex-col gap-2 mt-3" onSubmit={submit("invite")}><input className="input" aria-label="E-mail chauffeur" type="email" name="email" required/><button disabled={busy} className="btn btn-primary">Envoyer l’invitation</button></form></details>
      {toolbar("Nom ou immatriculation",["Tous","En ligne","Hors ligne","Sans véhicule","Invitations"])}
      {list.map(d=><details className="card card-pad" key={d.id}><summary>{d.name} · {d.accepted?(d.online?"En ligne":"Hors ligne"):"Invitation en attente"}</summary><p>{assigned(d.id)?.plate||"Aucun véhicule attribué"}</p><button className="btn btn-secondary" disabled={busy} onClick={()=>act("remove",{driver:d.id})}>Retirer de la flotte</button></details>)}{!list.length&&<p>Aucun chauffeur correspondant.</p>}</>}
    {page==="Véhicules"&&<><details className="card card-pad"><summary>Ajouter un véhicule</summary><form onSubmit={submit("vehicle")} className="flex-col gap-2 mt-3"><input className="input" name="model" aria-label="Marque et modèle" placeholder="Marque et modèle" required maxLength={100}/><input className="input" name="plate" aria-label="Immatriculation" placeholder="Immatriculation" required maxLength={15}/><button disabled={busy} className="btn btn-primary">Enregistrer</button></form></details>
      {toolbar("Plaque ou modèle",["Tous","Disponibles","Attribués"])}
      {cars.map(v=><div key={v.id} className="card card-pad"><strong>{v.model}</strong><p>{v.plate} · {drivers.find(d=>d.id===v.driver)?.name||"Disponible"}</p>{v.taken&&<button className="btn btn-secondary" disabled={busy} onClick={()=>act("release",{id:v.id,driver:v.driver})}>Libérer le véhicule</button>}</div>)}{!cars.length&&<p>Aucun véhicule correspondant.</p>}</>}
    {page==="Carte en direct"&&<><input className="input" aria-label="Rechercher sur la carte" placeholder="Nom du chauffeur ou plaque" value={query} onChange={e=>setQuery(e.target.value)}/><MapView center={center} drivers={markers} style={{height:"55dvh",borderRadius:20}}/><p>{markers.length} chauffeur(s) localisé(s)</p>{markers.map(d=><p key={d.id}>{d.name} · {assigned(d.id)?.plate||"Sans véhicule"}</p>)}</>}
    {page==="Documents"&&<><a className="btn btn-secondary" href="/terms">Consulter les conditions générales</a>{docTypes.map(kind=>{const d=info?.files.find(f=>f.kind===kind);return <details className="card card-pad" key={kind}><summary>{kind}</summary><p>{d?d.name+" · "+d.review:"À déposer"}{d?.reason&&" · "+d.reason}{d?.expiry&&" · Échéance "+d.expiry}</p>{d&&<button className="btn btn-secondary" onClick={()=>execute(()=>download(kind))}>Télécharger</button>}<form onSubmit={e=>upload(e,kind)} className="flex-col gap-2 mt-3"><label>PDF · 2 Mo maximum<input type="file" name="file" accept="application/pdf" required className="input"/></label><label>Échéance facultative<input className="input" type="date" name="expiry" defaultValue={d?.expiry||""}/></label><button className="btn btn-primary">{d?"Remplacer":"Déposer"}</button></form></details>;})}</>}
    {page==="Messagerie"&&<><select className="input" aria-label="Messages à afficher" value={filter} onChange={e=>setFilter(e.target.value)}><option>Tous</option><option>Non lus</option></select>{news.map(n=><article className="card card-pad" key={n.id}><strong>{n.message}</strong><p className="small muted">{new Date(n.created_at).toLocaleString("fr-FR")}</p>{!n.read_at&&<button className="btn btn-secondary btn-sm" onClick={()=>execute(()=>desk("read",{id:n.id}))}>Marquer comme lu</button>}</article>)}{info&&!news.length&&<p>Aucun message à afficher.</p>}</>}
    {["Revenus","Performances"].includes(page)&&<><div className="fleet-tools"><label>Du<input className="input" type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label>Au<input className="input" type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label></div>
      {page==="Performances"&&info&&<details className="card card-pad"><summary>Limite par course en espèces · {info.cashLimit==null?"Désactivée":money(info.cashLimit)}</summary><form className="flex-col gap-2 mt-3" onSubmit={e=>{e.preventDefault();const limit=new FormData(e.currentTarget).get("limit");execute(()=>desk("cash",{limit}));}}><label>Maximum en euros · 0 pour bloquer, vide pour désactiver<input key={info.cashLimit} className="input" name="limit" type="number" min="0" max="99999999" step="0.01" defaultValue={info.cashLimit??""}/></label><button className="btn btn-secondary">Enregistrer la limite</button></form></details>}
      {rows&&page==="Revenus"&&<section className="card card-pad"><h2>Courses terminées</h2><p className="fleet-row">Montant des courses<strong>{money(gross)}</strong></p><p className="fleet-row">Écart brut / net<strong>{money(gross-net)}</strong></p><p className="fleet-row">Revenus chauffeurs<strong>{money(net)}</strong></p></section>}
      {toolbar("Rechercher",page==="Performances"?["Tous","Chauffeurs","Véhicules"]:["Tous"])}
      {[...groups.entries()].filter(([,g])=>match(g.label)).map(([id,g])=><div className="card card-pad fleet-row" key={id}><span>{g.label}<br/><small>{g.trips} courses{page==='Performances'&&' · '+g.hours.toLocaleString('fr-FR',{maximumFractionDigits:1})+' h en ligne'}</small></span><strong>{money(g.net)}</strong></div>)}{rows&&!groups.size&&<p>Aucune course terminée sur cette période.</p>}</>}
    {page==="Compte société"&&<section className="card card-pad flex-col gap-3"><h2>{fleet.name}</h2><a className="btn btn-secondary" href="/contact">Contacter l’assistance</a><button className="btn btn-secondary" onClick={()=>signOut({callbackUrl:"/login"})}>Se déconnecter</button></section>}
  </div>;
}
export function FleetReviews(){
  const [items,setItems]=useState(null),[error,setError]=useState("");
  async function review(action,p={}) {
    try {
      setError("");
      const result=await supabase.rpc("sd_review_fleet_file",{action,p});
      if(result.error)throw Error(result.error.message);
      if(action==="download"){
        if(!result.data)throw Error("Le document a changé.");
        const file=result.data,url=URL.createObjectURL(new Blob([Uint8Array.from(atob(file.file),c=>c.charCodeAt(0))],{type:"application/pdf"}));
        const link=document.createElement("a");link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
      }else setItems(result.data);
    }catch(e){setError(e.message);}
  }
  return <section className="mt-4"><button className="btn btn-secondary" onClick={()=>review("list")}>Documents de flotte à examiner</button>
    {items?.length===0&&<p>Aucun document en attente.</p>}{error&&<p role="alert">{error}</p>}
    {items?.map(d=><form className="card card-pad mt-3" key={d.fleet+d.kind+d.version} onSubmit={e=>{e.preventDefault();review("Refuser",{...d,reason:new FormData(e.currentTarget).get("reason")});}}>
      <strong>{d.name} · {d.kind}</strong><div className="flex wrap gap-2 mt-2"><button type="button" className="btn btn-secondary" onClick={()=>review("download",d)}>Télécharger</button><button type="button" className="btn btn-primary" onClick={()=>review("Valider",d)}>Valider</button></div>
      <label>Motif de refus<input className="input" name="reason" required maxLength={500}/></label><button className="btn btn-secondary">Refuser</button></form>)}</section>;
}
