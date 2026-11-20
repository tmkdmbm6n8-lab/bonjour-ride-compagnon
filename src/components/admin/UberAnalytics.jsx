import { useMemo, useState } from "react";

const euro = n => Number.isFinite(n) ? n.toLocaleString("fr-FR",{style:"currency",currency:"EUR"}) : "—";
const avg = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0;
const day = d => new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"});
const stamp = d => new Date(d).toLocaleString("fr-FR");
const group = (rows,fn) => {
  const m=new Map();
  for(const r of rows){const k=fn(r);if(!m.has(k))m.set(k,[]);m.get(k).push(Number(r.price_eur));}
  return [...m].map(([label,prices])=>({label,count:prices.length,price:avg(prices)}));
};
function Trend({data}) {
  if(!data.length)return <p className="small muted">Aucune donnée pour cette période.</p>;
  const w=760,h=220,pad=36,max=Math.max(1,...data.map(x=>x.price))*1.1;
  const pts=data.map((x,i)=>[pad+i*(w-pad*2)/Math.max(1,data.length-1),h-pad-x.price/max*(h-pad*2)]);
  return <div style={{overflowX:"auto"}}><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Courbe du prix Uber moyen par jour" style={{width:"100%",minWidth:330}}>
    {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={pad} x2={w-pad} y1={h-pad-t*(h-pad*2)} y2={h-pad-t*(h-pad*2)} stroke="currentColor" opacity=".12"/><text x="2" y={h-pad-t*(h-pad*2)+4} fill="currentColor" fontSize="11">{Math.round(max*t)}€</text></g>)}
    <polyline points={pts.map(p=>p.join(",")).join(" ")} fill="none" stroke="#36a7e9" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
    {pts.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="4" fill="#36a7e9"><title>{data[i].label} : {euro(data[i].price)} · {data[i].count} relevés</title></circle>)}
    <text x={pad} y={h-7} fill="currentColor" fontSize="11">{data[0].label}</text>
    <text x={w-pad} y={h-7} fill="currentColor" textAnchor="end" fontSize="11">{data[data.length-1].label}</text>
  </svg></div>;
}
function Bars({data,label="Prix moyen",unit="€",maxItems=12}) {
  const items=[...data].slice(0,maxItems);
  const max=Math.max(1,...items.map(x=>x.price));
  if(!items.length)return <p className="small muted">Aucune donnée.</p>;
  return <div style={{display:"grid",gap:12}}>{items.map(x=><div key={x.label} style={{display:"grid",gridTemplateColumns:"90px 1fr 75px",gap:10,alignItems:"center"}}>
    <span className="tiny" title={x.label} style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.label}</span>
    <div style={{background:"var(--border)",height:12,borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:`${x.price/max*100}%`,background:"#36a7e9",borderRadius:8}}/></div>
    <span className="tiny" style={{textAlign:"right"}} title={`${x.count} observations`}>{unit==="€"?euro(x.price):x.price.toFixed(1)} <span className="muted">({x.count})</span></span>
  </div>)}</div>;
}
export default function UberAnalytics({observations=[],total=0,onRefresh}) {
  const [period,setPeriod]=useState("30");
  const [product,setProduct]=useState("all");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(0);
  const rows=useMemo(()=>{
    const min=period==="all"?0:Date.now()-Number(period)*86400000;
    return observations.filter(x=>new Date(x.observed_at).getTime()>=min&&(product==="all"||x.product_name===product)&&
      (!search||[x.pickup_name,x.dropoff_name,x.product_name].some(t=>String(t||"").toLowerCase().includes(search.toLowerCase()))));
  },[observations,period,product,search]);
  const prices=rows.map(x=>Number(x.price_eur)).filter(Number.isFinite);
  const distances=rows.map(x=>Number(x.distance_km)).filter(x=>Number.isFinite(x)&&x>0);
  const days=group(rows,x=>new Date(x.observed_at).toISOString().slice(0,10)).sort((a,b)=>a.label.localeCompare(b.label)).map(x=>({...x,label:x.label.slice(5)}));
  const hours=group(rows,x=>String(x.context?.hour??new Date(x.observed_at).getHours()).padStart(2,"0")+"h").sort((a,b)=>a.label.localeCompare(b.label));
  const products=group(rows,x=>x.product_name||"Inconnu").sort((a,b)=>b.count-a.count);
  const week=group(rows,x=>x.context?.weekend?"Week-end":"Semaine");
  const sources=group(rows,x=>x.context?.source==="uber_live_client"?"Recherche client":"Simulation");
  const unique=[...new Set(observations.map(x=>x.product_name))].sort();
  const stats=[["Observations",rows.length.toLocaleString("fr-FR")],["Prix moyen",euro(avg(prices))],["Prix minimum",euro(Math.min(...prices))],["Prix maximum",euro(Math.max(...prices))],["Distance moyenne",distances.length?avg(distances).toFixed(1)+" km":"—"],["Prix moyen/km",distances.length?euro(avg(rows.filter(x=>Number(x.distance_km)>0).map(x=>Number(x.price_eur)/Number(x.distance_km)))):"—"]];
  if(!prices.length){stats[2][1]="—";stats[3][1]="—";}
  const download=()=>{
    const cols=["observed_at","product_name","price_eur","distance_km","trip_seconds","pickup_name","dropoff_name"];
    const csv=[cols.join(";"),...rows.map(r=>cols.map(k=>'"'+String(r[k]??"").replaceAll('"','""')+'"').join(";"))].join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));a.download="strasdrive-tests-uber.csv";a.click();URL.revokeObjectURL(a.href);
  };
  return <section className="card card-pad mb-5" aria-label="Tableau de bord des observations Uber">
    <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
      <div><h3 style={{fontSize:"1.15rem"}}>Analyse graphique des tests Uber</h3><p className="tiny muted">Données réelles uniquement · {total.toLocaleString("fr-FR")} observations au total · graphiques sur les 1 000 dernières observations</p></div>
      <div className="flex gap-2 flex-wrap"><button className="btn btn-secondary btn-sm" onClick={onRefresh}>Actualiser</button><button className="btn btn-secondary btn-sm" onClick={download} disabled={!rows.length}>Exporter CSV</button></div>
    </div>
    <div className="flex flex-wrap gap-2 mb-4">
      <select className="input" aria-label="Période" value={period} onChange={e=>{setPeriod(e.target.value);setPage(0)}} style={{width:150}}><option value="1">24 heures</option><option value="7">7 jours</option><option value="30">30 jours</option><option value="90">90 jours</option><option value="365">1 an</option><option value="all">Toutes les dates</option></select>
      <select className="input" aria-label="Catégorie Uber" value={product} onChange={e=>{setProduct(e.target.value);setPage(0)}} style={{width:170}}><option value="all">Toutes les gammes</option>{unique.map(x=><option key={x} value={x}>{x}</option>)}</select>
      <input className="input" placeholder="Rechercher un trajet…" aria-label="Rechercher un trajet" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} style={{maxWidth:230}}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:10}} className="mb-5">
      {stats.map(([k,v])=><div key={k} style={{padding:14,border:"1px solid var(--border)",borderRadius:12}}><div className="tiny muted">{k}</div><div style={{fontWeight:750,fontSize:"1.25rem",marginTop:5}}>{v}</div></div>)}
    </div>
    {!rows.length?<div style={{padding:30,textAlign:"center",border:"1px dashed var(--border)",borderRadius:12}}><strong>Aucun test enregistré sur cette période</strong><p className="small muted mt-2">Vérifie la connexion Uber, la table Supabase et l'activation de la collecte. Aucun graphique fictif n'est affiché.</p></div>:<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16}}>
        <div style={{gridColumn:"1 / -1",border:"1px solid var(--border)",borderRadius:12,padding:16}}><strong>Évolution des prix moyens par jour</strong><Trend data={days}/></div>
        <div style={{border:"1px solid var(--border)",borderRadius:12,padding:16}}><strong>Prix par heure</strong><div className="mt-3"><Bars data={hours} maxItems={24}/></div></div>
        <div style={{border:"1px solid var(--border)",borderRadius:12,padding:16}}><strong>Prix par catégorie Uber</strong><div className="mt-3"><Bars data={products}/></div></div>
        <div style={{border:"1px solid var(--border)",borderRadius:12,padding:16}}><strong>Semaine et week-end</strong><div className="mt-3"><Bars data={week}/></div></div>
        <div style={{border:"1px solid var(--border)",borderRadius:12,padding:16}}><strong>Origine des observations</strong><div className="mt-3">{sources.map(x=><p className="small" key={x.label}>{x.label} : <strong>{x.count}</strong> observations</p>)}</div></div>
      </div>
      <div className="mt-5" style={{overflowX:"auto"}}>
        <div className="flex items-center justify-between mb-3"><strong>Historique détaillé</strong><span className="tiny muted">{rows.length} résultats</span></div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:700}}>
          <thead><tr>{["Date","Gamme","Départ","Arrivée","Distance","Durée","Prix Uber","Origine"].map(x=><th key={x} style={{textAlign:"left",padding:9,borderBottom:"1px solid var(--border)"}}>{x}</th>)}</tr></thead>
          <tbody>{rows.slice(page*20,(page+1)*20).map((x,i)=><tr key={x.id??i}>{[stamp(x.observed_at),x.product_name,x.pickup_name,x.dropoff_name,Number(x.distance_km).toFixed(1)+" km",x.trip_seconds?Math.round(x.trip_seconds/60)+" min":"—",euro(Number(x.price_eur)),x.context?.source==="uber_live_client"?"Client":"Simulation"].map((v,j)=><td key={j} style={{padding:9,borderBottom:"1px solid var(--border)"}}>{v}</td>)}</tr>)}</tbody>
        </table>
        <div className="flex gap-2 items-center mt-3"><button className="btn btn-secondary btn-sm" disabled={page===0} onClick={()=>setPage(x=>x-1)}>Précédent</button><span className="tiny">Page {page+1} / {Math.max(1,Math.ceil(rows.length/20))}</span><button className="btn btn-secondary btn-sm" disabled={(page+1)*20>=rows.length} onClick={()=>setPage(x=>x+1)}>Suivant</button></div>
      </div>
    </>}
  </section>;
}
