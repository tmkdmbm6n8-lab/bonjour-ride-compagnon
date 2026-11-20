// Observation-based fare learning. Never creates bookings or renews sessions.
import { uberProducts } from "./vtc-uber.server";

const CENTER = { lat: 48.5734, lng: 7.7521 };
const PLACES = [
  ["Place Kléber, Strasbourg",48.5839,7.7455],["Gare de Strasbourg",48.5851,7.7345],
  ["Aéroport de Strasbourg",48.5445,7.6282],["Place de Haguenau, Strasbourg",48.5945,7.7443],
  ["Gare de Schiltigheim",48.6068,7.7495],["Place de la République, Strasbourg",48.5870,7.7545],
  ["Gare de Saverne",48.7444,7.3620],["Gare de Sélestat",48.2606,7.4428],
  ["Gare de Colmar",48.0737,7.3477],["Gare de Molsheim",48.5405,7.5005],
  ["Gare d'Obernai",48.4632,7.4890],["Gare de Haguenau",48.8150,7.7870],
  ["Gare de Wissembourg",49.0310,7.9500],["Gare de Barr",48.4063,7.4500],
  ["Gare de Kehl",48.5760,7.8070],["Gare de Bischwiller",48.7670,7.8570],
  ["Gare de Sarrebourg",48.7340,7.0520],["Gare de Benfeld",48.3720,7.5930],
];
const radians = (n) => n * Math.PI / 180;
function km(a,b) {
  const dLat=radians(b.lat-a.lat),dLng=radians(b.lng-a.lng);
  const x=Math.sin(dLat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dLng/2)**2;
  return 12742*Math.asin(Math.sqrt(x));
}
function holiday(date) {
  const y=date.getUTCFullYear();
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7*100)%7;
  const m=Math.floor((a+11*h+22*l)/451);
  const easter=new Date(Date.UTC(y,Math.floor((h+l-7*m+114)/31)-1,((h+l-7*m+114)%31)+1));
  const day=(n)=>new Date(easter.getTime()+n*86400000).toISOString().slice(5,10);
  const md=date.toISOString().slice(5,10);
  return ["01-01","05-01","05-08","07-14","08-15","11-01","11-11","12-25",day(1),day(39),day(50),"12-26"].includes(md);
}
export function features(date, eventNames=[]) {
  const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",weekday:"short",hour:"2-digit",hourCycle:"h23",month:"2-digit",day:"2-digit"});
  const parts=Object.fromEntries(fmt.formatToParts(date).map(p=>[p.type,p.value]));
  const dow=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(parts.weekday);
  const md=`${parts.month}-${parts.day}`;
  return { hour:Number(parts.hour),dayOfWeek:dow,weekend:dow===0||dow===6,holiday:holiday(date),halloween:md==="10-31",newYearEve:md==="12-31",christmasEve:md==="12-24",events:eventNames };
}
export async function learningStatus(admin) {
  const config=await admin.from("pricing_rules").select("rule").eq("vehicle_type","uber_ai_learning").maybeSingle();
  if(config.error)throw config.error;
  const count=await admin.from("uber_price_observations").select("id",{count:"exact",head:true});
  if(count.error)throw count.error;
  const recent=await admin.from("uber_price_observations").select("id,observed_at,price_eur,product_name,pickup_name,dropoff_name,distance_km,trip_seconds,context,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng").order("observed_at",{ascending:false}).limit(1000);
  if(recent.error)throw recent.error;
  return {config:config.data?.rule||{enabled:false,radiusKm:100},count:count.count||0,recent:recent.data||[]};
}
async function stopLearning(admin, settings, reason) {
  const stoppedAt = new Date().toISOString();
  const updated = await admin.from("pricing_rules").upsert({
    vehicle_type: "uber_ai_learning",
    is_active: false,
    rule: { ...settings, enabled: false, stoppedAt, stopReason: reason },
  }, { onConflict: "vehicle_type" });
  if (updated.error) throw updated.error;
  return { ok: false, stopped: true, reason, error: reason };
}
// Record only original, direct Uber offers; never client discounts or fallback fares.
export async function recordClientUberQuote(admin, pickup, dropoff, products, route) {
  if (!Array.isArray(products) || !products.length) return { saved: 0 };
  // Client-originated genuine Uber fares are always useful training observations.
  // The admin toggle only controls automated 5-second sampling.
  if (![pickup?.lat,pickup?.lng,dropoff?.lat,dropoff?.lng].every(Number.isFinite)) return { saved: 0 };
  const distanceKm = Number(route?.distanceMeters) > 0 ? Number(route.distanceMeters)/1000 : km(pickup,dropoff);
  const context = features(new Date());
  const rows = products.filter(p => p.currency === "EUR" && Number.isFinite(p.price) && p.price > 0).map(p => ({
    pickup_name: "Recherche client", dropoff_name: "Recherche client",
    pickup_lat: pickup.lat, pickup_lng: pickup.lng,
    dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
    distance_km: distanceKm, product_name: p.name || "Uber",
    price_eur: p.price, trip_seconds: p.tripSeconds || null,
    context: { ...context, source: "uber_live_client" },
  }));
  if (!rows.length) return { saved: 0 };
  const result = await admin.from("uber_price_observations").insert(rows);
  if (result.error) throw result.error;
  return { saved: rows.length };
}
export async function runLearningSample(admin) {
  const config=await admin.from("pricing_rules").select("rule").eq("vehicle_type","uber_ai_learning").maybeSingle();
  if(config.error)throw config.error;
  const settings=config.data?.rule||{};
  if(!settings.enabled)return {skipped:"disabled"};
  const radius=Math.max(1,Math.min(200,Number(settings.radiusKm)||100));
  const pool=PLACES.filter(p=>km(CENTER,{lat:p[1],lng:p[2]})<=radius);
  if(pool.length<2)return {skipped:"insufficient_addresses"};
  const first=Math.floor(Math.random()*pool.length);
  const second=(first+1+Math.floor(Math.random()*(pool.length-1)))%pool.length;
  const [nameA,latA,lngA]=pool[first],[nameB,latB,lngB]=pool[second];
  const cookie=await admin.from("pricing_rules").select("rule").eq("vehicle_type","uber_cookie").maybeSingle();
  if(cookie.error)throw cookie.error;
  const products=await uberProducts({lat:latA,lng:lngA},{lat:latB,lng:lngB},cookie.data?.rule?.cookie||null);
  if(!products?.length)return stopLearning(admin, settings, "Aucun tarif direct Uber reçu : collecte arrêtée automatiquement.");
  const now=new Date();
  const context=features(now);
  const observations=products.filter(p=>p.currency==="EUR"&&Number.isFinite(p.price)&&p.price>0).map(p=>({
    observed_at:now.toISOString(),pickup_name:nameA,dropoff_name:nameB,
    pickup_lat:latA,pickup_lng:lngA,dropoff_lat:latB,dropoff_lng:lngB,
    distance_km:km({lat:latA,lng:lngA},{lat:latB,lng:lngB}),
    product_name:p.name||"Uber",price_eur:p.price,trip_seconds:p.tripSeconds||null,
    context,
  }));
  if(!observations.length)return stopLearning(admin, settings, "Aucun prix Uber valide en euros : collecte arrêtée automatiquement.");
  const insert=await admin.from("uber_price_observations").insert(observations);
  if(insert.error)throw insert.error;
  return {ok:true,saved:observations.length,pickup:nameA,dropoff:nameB};
}
// Interpretable nonparametric estimator. Holdout accuracy must be measured before using it for real fares.
export async function predictLearnedPrice(admin,{distanceKm,productName="UberX",date=new Date()}) {
  const res=await admin.from("uber_price_observations").select("price_eur,distance_km,product_name,context").eq("product_name",productName).order("observed_at",{ascending:false}).limit(1000);
  if(res.error)throw res.error;
  const target=features(date);
  const ranked=(res.data||[]).filter(x=>x.distance_km>0).map(x=>{
    const c=x.context||{};
    const score=Math.abs(Math.log(Math.max(.1,distanceKm)/x.distance_km))*3+
      (c.hour==null?2:Math.min(Math.abs(c.hour-target.hour),24-Math.abs(c.hour-target.hour)))*.12+
      (c.weekend!==target.weekend?1:0)+(c.holiday!==target.holiday?1:0)+
      (c.halloween!==target.halloween?1:0);
    return {...x,score};
  }).sort((a,b)=>a.score-b.score).slice(0,30);
  if(ranked.length<10)return {ready:false,samples:ranked.length};
  const weights=ranked.map(x=>1/(.5+x.score));
  const total=weights.reduce((a,b)=>a+b,0);
  const price=ranked.reduce((a,x,i)=>a+weights[i]*x.price_eur*Math.max(.4,Math.min(2.5,distanceKm/x.distance_km)),0)/total;
  return {ready:true,price:Math.round(price*100)/100,samples:ranked.length,method:"weighted-neighbors"};
}
