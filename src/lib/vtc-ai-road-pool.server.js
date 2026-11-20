import { googleRouteRequest } from "./vtc-routing";
import { randomAddress, randomAddressNear } from "./vtc-pricing-learning.server";

export const ROAD_BANDS = [
 {key:"8-9",min:8,max:9},{key:"7-8",min:7,max:8},
 {key:"6-7",min:6,max:7},{key:"5-6",min:5,max:6},
 {key:"4-5",min:4,max:5},{key:"3-4",min:3,max:4},
 {key:"2-3",min:2,max:3},{key:"1-2",min:1,max:2},
 {key:"0.5-1",min:0.5,max:1},
];
const TARGET=1000;
const GATEWAY="https://connector-gateway.lovable.dev/google_maps";
const must=r=>{if(r.error)throw r.error;return r.data;};

async function drivingDistanceKm(a,b){
 const token=process.env.LOVABLE_API_KEY,key=process.env.GOOGLE_MAPS_API_KEY;
 if(!token||!key)throw new Error("Google Maps Routes non configuré : LOVABLE_API_KEY / GOOGLE_MAPS_API_KEY");
 const res=await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`,{
  method:"POST",
  headers:{Authorization:`Bearer ${token}`,"X-Connection-Api-Key":key,"Content-Type":"application/json","X-Goog-FieldMask":"routes.distanceMeters"},
  body:JSON.stringify(googleRouteRequest(a,b)),
  signal:AbortSignal.timeout(10000)
 });
 if(!res.ok)throw new Error(`Google Routes HTTP ${res.status}`);
 const json=await res.json(),meters=Number(json.routes?.[0]?.distanceMeters);
 // Never use a straight-line approximation to fill a road-distance band.
 return Number.isFinite(meters)&&meters>0?meters/1000:null;
}

export async function roadPoolStatus(admin){
 const result=must(await admin.from("uber_ai_road_routes").select("distance_band,compared_at").limit(10000));
 const bands=ROAD_BANDS.map(b=>({...b,target:TARGET,count:0,compared:0}));
 const byKey=new Map(bands.map(b=>[b.key,b]));
 for(const row of result){const b=byKey.get(row.distance_band);if(b){b.count++;if(row.compared_at)b.compared++;}}
 return {bands,total:bands.reduce((n,b)=>n+b.count,0),target:9000,compared:bands.reduce((n,b)=>n+b.compared,0)};
}

export async function buildRoadPoolBatch(admin,{limit=5}={}){
 const max=Math.max(1,Math.min(10,Number(limit)||5));
 const before=await roadPoolStatus(admin);
 const added=Object.fromEntries(ROAD_BANDS.map(b=>[b.key,0]));
 let attempts=0,duplicates=0,unroutable=0;
 // Bounded requests; client repeats batches while admin page is open.
 while(attempts<max*12 && Object.values(added).reduce((a,b)=>a+b,0)<max){
  const band=ROAD_BANDS.find(b=>b.count+added[b.key]<TARGET);
  if(!band)break;
  attempts++;
  const pickup=await randomAddress(15);
  if(!pickup)continue;
  const radius=Math.min(9,Math.max(0.7,band.max*0.84));
  const dropoff=await randomAddressNear(pickup,radius,15);
  if(!dropoff||pickup.id===dropoff.id)continue;
  const straightKm=straightDistance(pickup,dropoff);
  if(straightKm>band.max||straightKm<band.min*0.45)continue;
  let road;
  try{road=await drivingDistanceKm(pickup,dropoff);}
  catch(error){if(/non configuré/.test(error.message))throw error;unroutable++;continue;}
  if(road===null){unroutable++;continue;}
  const actual=ROAD_BANDS.find(b=>road>=b.min&&road<b.max);
  if(!actual||actual.count+added[actual.key]>=TARGET)continue;
  const row={pickup_key:pickup.id,dropoff_key:dropoff.id,
   pickup_name:pickup.name,dropoff_name:dropoff.name,
   pickup_lat:pickup.lat,pickup_lng:pickup.lng,dropoff_lat:dropoff.lat,dropoff_lng:dropoff.lng,
   road_distance_km:Number(road.toFixed(3)),distance_band:actual.key};
  const inserted=await admin.from("uber_ai_road_routes").upsert(row,{
   onConflict:"pickup_key,dropoff_key",ignoreDuplicates:true
  }).select("id");
  if(inserted.error)throw inserted.error;
  if(inserted.data?.length)added[actual.key]++;else duplicates++;
 }
 return {...await roadPoolStatus(admin),added,attempts,duplicates,unroutable};
}
function straightDistance(a,b){
 const rad=x=>x*Math.PI/180;
 const dLat=rad(b.lat-a.lat),dLon=rad(b.lng-a.lng);
 return 12742*Math.asin(Math.sqrt(Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2));
}
