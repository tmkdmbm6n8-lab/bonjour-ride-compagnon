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
  return {config:config.data?.rule||{enabled:false,radiusKm:100},count:count.count||0};
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
async function randomAddress(radius) {
  for (let attempt=0;attempt<12;attempt++) {
    const angle=Math.random()*2*Math.PI;
    const radiusKm=Math.sqrt(Math.random())*radius;
    const lat=CENTER.lat+(radiusKm*Math.cos(angle))/111.2;
    const lng=CENTER.lng+(radiusKm*Math.sin(angle))/(111.2*Math.cos(radians(CENTER.lat)));
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),4500);
    try {
      const response=await fetch(`https://api-adresse.data.gouv.fr/reverse/?lat=${lat}&lon=${lng}&type=housenumber&limit=1`,{signal:controller.signal});
      if(!response.ok)continue;
      const result=await response.json();
      const feature=result.features?.[0];
      const props=feature?.properties||{};
      const coords=feature?.geometry?.coordinates;
      if(!props.housenumber||!props.street||!props.city||!Array.isArray(coords))continue;
      const address={name:props.label||`${props.housenumber} ${props.street}, ${props.city}`,lat:Number(coords[1]),lng:Number(coords[0]),id:String(props.id||`${coords[1]}:${coords[0]}`)};
      if(![address.lat,address.lng].every(Number.isFinite))continue;
      if(km(CENTER,address)>radius)continue;
      if(km({lat,lng},address)>1.5)continue;
      return address;
    } catch(error) {
      console.warn("[pricing-ai] Address lookup failed:",error?.message||error);
    } finally {clearTimeout(timer);}
  }
  return null;
}

async function randomAddressNear(center,nearRadius,globalRadius) {
  for(let attempt=0;attempt<12;attempt++){
    const angle=Math.random()*2*Math.PI;
    const distance=Math.sqrt(Math.random())*nearRadius;
    const lat=center.lat+distance*Math.cos(angle)/111.2;
    const lng=center.lng+distance*Math.sin(angle)/(111.2*Math.cos(radians(center.lat)));
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),4500);
    try {
      const response=await fetch(`https://api-adresse.data.gouv.fr/reverse/?lat=${lat}&lon=${lng}&type=housenumber&limit=1`,{signal:controller.signal});
      if(!response.ok)continue;
      const feature=(await response.json()).features?.[0];
      const props=feature?.properties||{},coords=feature?.geometry?.coordinates;
      if(!props.housenumber||!props.street||!props.city||!Array.isArray(coords))continue;
      const address={name:props.label||`${props.housenumber} ${props.street}, ${props.city}`,lat:Number(coords[1]),lng:Number(coords[0]),id:String(props.id||`${coords[1]}:${coords[0]}`)};
      if(![address.lat,address.lng].every(Number.isFinite))continue;
      if(km(CENTER,address)>globalRadius||km(center,address)>nearRadius*1.1)continue;
      return address;
    }catch(error){console.warn("[pricing-ai] Nearby address lookup failed:",error?.message||error);}
    finally{clearTimeout(timer);}
  }
  return null;
}
export async function compareRandomUberAi(admin,{maxDistanceKm=9}={}) {
  const maxKm=Number(maxDistanceKm);
  if(![9,100].includes(maxKm))throw new Error("Distance maximale invalide");
  const config=await admin.from("pricing_rules").select("rule").eq("vehicle_type","uber_ai_learning").maybeSingle();
  if(config.error)throw config.error;
  const radius=Math.max(1,Math.min(200,Number(config.data?.rule?.radiusKm)||100));
  let pickup=null,dropoff=null;
  for(let attempt=0;attempt<24;attempt++){
    pickup=await randomAddress(radius);
    if(!pickup)continue;
    // Draw destination close enough to pickup for the requested trip length.
    const destinationRadius=Math.min(radius,maxKm/2);
    dropoff=await randomAddressNear(pickup,destinationRadius,radius);
    if(pickup&&dropoff&&pickup.id!==dropoff.id&&km(pickup,dropoff)>=1&&km(pickup,dropoff)<=maxKm)break;
  }
  if(!pickup||!dropoff||pickup.id===dropoff.id||km(pickup,dropoff)<1||km(pickup,dropoff)>maxKm)
    throw new Error("Impossible de trouver un trajet numéroté dans la limite de "+maxKm+" km");
  const cookie=await admin.from("pricing_rules").select("rule").eq("vehicle_type","uber_cookie").maybeSingle();
  if(cookie.error)throw cookie.error;
  const offers=await uberProducts(pickup,dropoff,cookie.data?.rule?.cookie||null);
  if(!Array.isArray(offers)||!offers.length)throw new Error("Uber ne fournit aucun tarif pour ce trajet");
  const distanceKm=km(pickup,dropoff);
  const at=new Date();
  const comparisons=[];
  for(const offer of offers){
    if(offer.currency!=="EUR"||!Number.isFinite(offer.price)||offer.price<=0)continue;
    const ai=await predictLearnedPrice(admin,{distanceKm,productName:offer.name,date:at});
    comparisons.push({
      category:offer.name,
      uberPrice:offer.price,
      aiPrice:ai.ready?ai.price:null,
      differenceEur:ai.ready?Math.round((ai.price-offer.price)*100)/100:null,
      differencePct:ai.ready?Math.round(((ai.price-offer.price)/offer.price)*10000)/100:null,
      samples:ai.samples,
      ready:ai.ready
    });
  }
  if(!comparisons.length)throw new Error("Uber ne fournit aucun prix valide en euros");
  return {pickup:pickup.name,dropoff:dropoff.name,distanceKm:Math.round(distanceKm*100)/100,
    comparedAt:at.toISOString(),comparisons,
    distanceMethod:"à vol d'oiseau",note:"Comparaison expérimentale des prix Uber bruts et des prédictions IA, sans remise ni minimum tarifaire. La distance utilisée est à vol d'oiseau."};
}

export async function runLearningSample(admin) {
  const config=await admin.from("pricing_rules").select("rule").eq("vehicle_type","uber_ai_learning").maybeSingle();
  if(config.error)throw config.error;
  const settings=config.data?.rule||{};
  if(!settings.enabled)return {skipped:"disabled"};
  const radius=Math.max(1,Math.min(200,Number(settings.radiusKm)||100));
  // Sample genuine numbered street addresses from the French national address API.
  // Every address is claimed permanently and atomically before it is tested.
  let selected=null;
  for(let attempt=0;attempt<15;attempt++){
    const pickup=await randomAddress(radius);
    if(!pickup)continue;
    const dropoff=await randomAddressNear(pickup,4.3,radius);
    if(!dropoff||pickup.id===dropoff.id||km(pickup,dropoff)>9||km(pickup,dropoff)<0.1)continue;
    const claim=await admin.rpc("claim_uber_random_addresses",{
      p_pickup_key:pickup.id,p_dropoff_key:dropoff.id,
      p_pickup_name:pickup.name,p_dropoff_name:dropoff.name,
      p_pickup_lat:pickup.lat,p_pickup_lng:pickup.lng,
      p_dropoff_lat:dropoff.lat,p_dropoff_lng:dropoff.lng
    });
    if(claim.error)throw new Error("Migration SQL 0012 nécessaire : "+claim.error.message);
    if(claim.data===true){selected=[pickup,dropoff];break;}
  }
  if(!selected)return {skipped:"Aucune nouvelle paire d'adresses numérotées trouvée ; aucune adresse réutilisée"};
  const [{name:nameA,lat:latA,lng:lngA},{name:nameB,lat:latB,lng:lngB}]=selected;
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
// Prefer genuine historical Uber quotes for the same category, distance, weekday
// and a +/-30-minute clock window (Europe/Paris). Never extrapolate from
// unrelated journeys or fabricate a low fare when matching data is missing.
export async function predictLearnedPrice(admin,{distanceKm,productName="UberX",date=new Date()}) {
  const targetKm=Number(distanceKm);
  if(!Number.isFinite(targetKm)||targetKm<=0||targetKm>500)
    return {ready:false,samples:0,reason:"Distance invalide"};
  const res=await admin.from("uber_price_observations")
    .select("price_eur,distance_km,product_name,context,observed_at")
    .eq("product_name",productName)
    .order("observed_at",{ascending:false}).limit(5000);
  if(res.error)throw res.error;
  const target=features(date);
  const minuteOfDay=(d)=>{
    const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
      timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"
    }).formatToParts(d).map(p=>[p.type,p.value]));
    return Number(parts.hour)*60+Number(parts.minute);
  };
  const targetMinute=minuteOfDay(date);
  const clockGap=(a,b)=>{const diff=Math.abs(a-b);return Math.min(diff,1440-diff);};
  const distanceTolerance=Math.max(0.3,targetKm*0.15);
  const candidates=(res.data||[]).filter(x=>
    Number.isFinite(Number(x.price_eur))&&Number(x.price_eur)>0&&
    Number.isFinite(Number(x.distance_km))&&Number(x.distance_km)>0&&
    Math.abs(Number(x.distance_km)-targetKm)<=distanceTolerance&&
    x.observed_at&&!Number.isNaN(new Date(x.observed_at).getTime())
  ).map(x=>{
    const observed=new Date(x.observed_at);
    const context=features(observed);
    return {...x,weekday:context.dayOfWeek,minute:minuteOfDay(observed),
      gap:clockGap(minuteOfDay(observed),targetMinute)};
  });
  // Always prioritize the nearest clock time, irrespective of weekday.
  // Prefer the same weekday only when two observations have comparable time gaps.
  // Do not widen the distance tolerance to manufacture a fare.
  const ranked=candidates.sort((a,b)=>
    a.gap-b.gap ||
    Number(b.weekday===target.dayOfWeek)-Number(a.weekday===target.dayOfWeek) ||
    Math.abs(a.distance_km-targetKm)-Math.abs(b.distance_km-targetKm)
  );
  if(ranked.length<3)return {ready:false,samples:ranked.length,
    reason:"Pas assez de courses Uber comparables pour cette distance et catégorie",
    matchingDistanceKm:distanceTolerance,requiredSamples:3};
  // Choose a local time neighborhood around the closest available observation,
  // rather than mixing prices from very different hours.
  const nearestGap=ranked[0].gap;
  const selected=ranked.filter(x=>x.gap<=nearestGap+30).slice(0,40);
  if(selected.length<3)return {ready:false,samples:selected.length,
    reason:"Moins de trois tarifs Uber dans les 30 minutes autour de l'heure de référence la plus proche",
    nearestTimeGapMinutes:nearestGap,requiredSamples:3};
  const ordered=selected;
  // Median protects against anomalously low/high fares. Do not scale prices
  // from very different distances; only narrow distance matches are accepted.
  const prices=ordered.map(x=>Number(x.price_eur)).sort((a,b)=>a-b);
  const mid=Math.floor(prices.length/2);
  const median=prices.length%2?prices[mid]:(prices[mid-1]+prices[mid])/2;
  return {ready:true,price:Math.round(median*100)/100,samples:ordered.length,
    method:"closest-time-uber-median",nearestTimeGapMinutes:nearestGap,
    matchingDistanceKm:distanceTolerance};
}

export async function learningObservationsPage(admin, { offset=0, limit=500 }={}) {
  const start=Math.max(0,Math.floor(Number(offset)||0));
  const size=Math.max(1,Math.min(500,Math.floor(Number(limit)||500)));
  const res=await admin.from("uber_price_observations")
    .select("id,observed_at,price_eur,product_name,pickup_name,dropoff_name,distance_km,trip_seconds,context,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng")
    .order("observed_at",{ascending:false}).order("id",{ascending:false})
    .range(start,start+size-1);
  if(res.error)throw res.error;
  return {observations:res.data||[],offset:start,nextOffset:start+(res.data||[]).length,hasMore:(res.data||[]).length===size};
}
