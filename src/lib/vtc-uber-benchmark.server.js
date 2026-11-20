import { uberProducts } from "./vtc-uber.server";

const POINTS=[
["Place Kléber",48.5839,7.7455],["Gare Strasbourg",48.5851,7.7345],["Aéroport Strasbourg",48.5445,7.6282],
["Place Haguenau",48.5945,7.7443],["Schiltigheim",48.6068,7.7495],["République",48.587,7.7545],
["Saverne",48.7444,7.362],["Sélestat",48.2606,7.4428],["Colmar",48.0737,7.3477],
["Molsheim",48.5405,7.5005],["Obernai",48.4632,7.489],["Haguenau",48.815,7.787],
["Wissembourg",49.031,7.95],["Barr",48.4063,7.45],["Kehl",48.576,7.807],
["Bischwiller",48.767,7.857],["Sarrebourg",48.734,7.052],["Benfeld",48.372,7.593]
];
const must=(r)=>{if(r.error)throw r.error;return r.data;};
export async function ensureBenchmarkRoutes(admin) {
  const existing=must(await admin.from("uber_benchmark_routes").select("id,created_at").order("id").limit(1));
  if(existing.length)return;
  // Select 100 distinct real, fixed point-to-point routes once and retain them for a year.
  const candidates=[];
  for(let i=0;i<POINTS.length;i++)for(let j=0;j<POINTS.length;j++){
    if(i===j)continue;
    candidates.push({pickup_name:POINTS[i][0],pickup_lat:POINTS[i][1],pickup_lng:POINTS[i][2],
      dropoff_name:POINTS[j][0],dropoff_lat:POINTS[j][1],dropoff_lng:POINTS[j][2]});
  }
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  must(await admin.from("uber_benchmark_routes").upsert(candidates.slice(0,100),{onConflict:"pickup_lat,pickup_lng,dropoff_lat,dropoff_lng",ignoreDuplicates:true}));
}
export async function benchmarkBatch(admin,{batch=0,batchSize=2}={}) {
  await ensureBenchmarkRoutes(admin);
  const offset=Math.max(0,Math.min(49,Number(batch)||0))*2;
  const routes=must(await admin.from("uber_benchmark_routes").select("*").order("id").range(offset,offset+1));
  if(routes.some(r=>Date.now()-new Date(r.created_at).getTime()>=365*86400000)) return {ok:true,expired:true,saved:0,message:"Période de suivi de 365 jours terminée"};
  const hourBucket=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
  const cookieRow=must(await admin.from("pricing_rules").select("rule").eq("vehicle_type","uber_cookie").maybeSingle());
  const cookie=cookieRow?.rule?.cookie||null;
  if(!cookie)return {ok:false,stopped:true,error:"Cookie Uber absent",hourBucket};
  let saved=0;
  for(const route of routes){
    const offers=await uberProducts({lat:route.pickup_lat,lng:route.pickup_lng},{lat:route.dropoff_lat,lng:route.dropoff_lng},cookie);
    if(!offers?.length)return {ok:false,stopped:true,error:"Prix Uber indisponible : arrêt du lot, aucun tarif de secours enregistré",saved,hourBucket,routeId:route.id};
    const prices=offers.filter(p=>p.currency==="EUR"&&Number.isFinite(p.price)&&p.price>0).map(p=>({
      route_id:route.id,hour_bucket:hourBucket,product_name:p.name||"Uber",price_eur:p.price,trip_seconds:p.tripSeconds||null
    }));
    if(!prices.length)return {ok:false,stopped:true,error:"Aucun prix Uber valide",saved,hourBucket,routeId:route.id};
    must(await admin.from("uber_benchmark_prices").upsert(prices,{onConflict:"route_id,hour_bucket,product_name"}));
    saved+=prices.length;
  }
  return {ok:true,saved,routesTested:routes.length,hourBucket};
}
export async function benchmarkStatus(admin) {
  const routes=await admin.from("uber_benchmark_routes").select("id",{count:"exact",head:true});
  if(routes.error)throw routes.error;
  const summary=await admin.rpc("uber_benchmark_hourly_summary");
  if(summary.error)throw summary.error;
  return {routeCount:routes.count||0,hourly:summary.data||[]};
}
