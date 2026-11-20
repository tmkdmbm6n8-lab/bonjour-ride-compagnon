import { apiFetch as fetch } from "@/lib/archive-fetch";
import { useEffect, useMemo, useState } from "react";
const money=n=>Number(n).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
export default function UberBenchmarkChart(){
 const [data,setData]=useState(null),[error,setError]=useState("");
 const [product,setProduct]=useState("UberX"),[period,setPeriod]=useState("7");
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{
   const res=await fetch("/api/admin/uber-benchmark");
   const type=res.headers.get("content-type")||"";
   if(!type.includes("application/json"))throw new Error(`Le serveur a renvoyé une page au lieu de données (HTTP ${res.status}). Vérifier le déploiement.`);
   const body=await res.json();
   if(!res.ok)throw new Error(body.error||"Historique indisponible : vérifier la migration SQL 0011");
   if(active){setData(body);setError("");}
  }catch(e){if(active)setError(e.message);}};
  load();const timer=setInterval(()=>{if(document.visibilityState==="visible")load();},60000);
  return()=>{active=false;clearInterval(timer);};
 },[]);
 const products=useMemo(()=>[...new Set((data?.hourly||[]).map(x=>x.product))], [data]);
 const selected=products.includes(product)?product:products[0];
 const rows=useMemo(()=> (data?.hourly||[]).filter(x=>x.product===selected&&new Date(x.hour).getTime()>=Date.now()-Number(period)*86400000),[data,selected,period]);
 const w=880,h=260,left=54,right=18,top=18,bottom=42;
 const min=rows.length?Math.min(...rows.map(x=>x.average)):0,max=rows.length?Math.max(...rows.map(x=>x.average)):1;
 const lo=Math.max(0,min-(max-min||1)*.2),hi=max+(max-min||1)*.2;
 const first=rows.length?new Date(rows[0].hour).getTime():0,last=rows.length?new Date(rows[rows.length-1].hour).getTime():1;
 const points=rows.map(x=>({
  x:left+(new Date(x.hour).getTime()-first)/Math.max(1,last-first)*(w-left-right),
  y:h-bottom-(x.average-lo)/Math.max(.01,hi-lo)*(h-top-bottom),...x
 }));
 const latest=rows.at(-1),previous=rows.length>1?rows.at(-2):null;
 const delta=latest&&previous?((latest.average/previous.average)-1)*100:null;
 return <section className="card card-pad mb-5" aria-label="Courbe horaire des 100 trajets fixes Uber">
  <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
   <div><h3 style={{fontSize:"1.2rem"}}>Évolution des prix heure par heure</h3>
   <p className="small muted">Cohorte fixe : {data?.routeCount??"—"} / 100 trajets · seules les observations de cette cohorte entrent dans cette courbe</p></div>
   <div className="flex gap-2">
    <select className="input" aria-label="Gamme Uber suivie" value={selected||""} onChange={e=>setProduct(e.target.value)}>{products.length?products.map(x=><option key={x}>{x}</option>):<option value="">Aucune gamme</option>}</select>
    <select className="input" aria-label="Période de suivi" value={period} onChange={e=>setPeriod(e.target.value)}><option value="1">24 h</option><option value="7">7 jours</option><option value="30">30 jours</option><option value="365">1 an</option></select>
   </div>
  </div>
  {error&&<p className="small" style={{color:"#e36b6b"}}>{error}</p>}
  {rows.length?<><div className="flex flex-wrap gap-4 mb-4"><div><span className="tiny muted">Dernier prix moyen</span><div style={{fontSize:"1.6rem",fontWeight:750}}>{money(latest.average)}</div></div><div><span className="tiny muted">Variation vs relevé précédent</span><div style={{fontSize:"1.6rem",fontWeight:750}}>{delta==null?"—":(delta>=0?"+":"")+delta.toFixed(1)+" %"}</div></div><div><span className="tiny muted">Trajets relevés à la dernière heure</span><div style={{fontSize:"1.6rem",fontWeight:750}}>{latest.count} / 100</div></div></div>
  <div style={{overflowX:"auto"}}><svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",minWidth:340}} role="img" aria-label="Courbe du prix Uber moyen sur les 100 trajets fixes par heure">
   {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={left} x2={w-right} y1={h-bottom-t*(h-top-bottom)} y2={h-bottom-t*(h-top-bottom)} stroke="currentColor" opacity=".12"/><text x="3" y={h-bottom-t*(h-top-bottom)+4} fill="currentColor" fontSize="12">{(lo+(hi-lo)*t).toFixed(0)} €</text></g>)}
   <polyline fill="none" stroke="#3aa7ed" strokeWidth="3" strokeLinejoin="round" points={points.map(p=>`${p.x},${p.y}`).join(" ")}/>
   {points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3" fill="#3aa7ed"><title>{new Date(p.hour).toLocaleString("fr-FR")} : {money(p.average)} ({p.count} trajets)</title></circle>)}
   <text x={left} y={h-8} fill="currentColor" fontSize="12">{new Date(first).toLocaleString("fr-FR")}</text>
   <text x={w-right} y={h-8} textAnchor="end" fill="currentColor" fontSize="12">{new Date(last).toLocaleString("fr-FR")}</text>
  </svg></div><p className="tiny muted mt-2">Attention : si moins de 100 trajets sont disponibles sur une heure, la moyenne peut changer aussi à cause des trajets manquants. Survoler les points pour voir le nombre de relevés.</p></>:
  <div style={{padding:28,textAlign:"center",border:"1px dashed var(--border)",borderRadius:12}}><strong>Aucune mesure horaire disponible</strong><p className="small muted mt-2">La courbe apparaîtra après l'exécution du premier cycle de tests des trajets fixes.</p></div>}
 </section>;
}
