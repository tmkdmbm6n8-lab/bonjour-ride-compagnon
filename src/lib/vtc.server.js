import {DEFAULT_PRICING,calculateFare} from './vtc-pricing';
import {haversineDistance} from './utils/geo';
const active=['searching','accepted','arrived','in_progress'];
function required(result){if(result.error)throw new Error(result.error.message);return result.data;}
function driverShape(d){return d?{...d,_id:d.id,isOnline:d.is_online,isApproved:d.is_approved,userId:d.user_id}:null;}
function profileShape(p,email){return {...p,_id:p.id,createdAt:p.created_at,email:email||'',wallet:{balance:Number(p.balance),currency:'EUR'}};}
async function serialize(db,r,actor,raw=false){
 if(!r)return null;
 let driver;
 if(r.driver_id){const p=required(await db.from('profiles').select('*').eq('id',r.driver_id).single());const d=required(await db.from('drivers').select('*').eq('user_id',r.driver_id).single());driver={id:p.id,name:p.name,avatar:p.avatar,rating:p.rating.average,totalTrips:d.stats.totalTrips,vehicle:d.vehicle,location:d.location};}
 const out={...r,id:r.id,_id:r.id,createdAt:r.created_at,completedAt:r.completed_at,vehicleType:r.vehicle_type,driver,pin:r.rider_id===actor?r.pin:undefined};
 if(raw){const p=required(await db.from('profiles').select('id,name,username').eq('id',r.rider_id).single());out.riderId=p;out.driverId=driver;}
 return out;
}
async function routeBetween(a,b){
 if(!a||!b||![a.lat,a.lng,b.lat,b.lng].every(Number.isFinite)||Math.abs(a.lat)>90||Math.abs(b.lat)>90||Math.abs(a.lng)>180||Math.abs(b.lng)>180)throw new Error('Adresses invalides');
 try{const res=await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,{signal:AbortSignal.timeout(8000)});const j=await res.json();if(j.routes?.[0])return {distanceMeters:j.routes[0].distance,durationSeconds:j.routes[0].duration,geometry:j.routes[0].geometry.coordinates};}catch{}
 const distanceMeters=Math.round(haversineDistance(a.lat,a.lng,b.lat,b.lng)*1350);
 return {distanceMeters,durationSeconds:distanceMeters/25000*3600,geometry:[[a.lng,a.lat],[b.lng,b.lat]]};
}
async function estimates(db,a,b){const route=await routeBetween(a,b);const rows=required(await db.from('pricing_rules').select('*'));const rules={...DEFAULT_PRICING};for(const row of rows)rules[row.vehicle_type]=row.rule;return {route,estimates:Object.fromEntries(Object.entries(rules).map(([k,v])=>[k,calculateFare(v,route.distanceMeters,route.durationSeconds)]))};}
export async function handleVtc(input,context){
 const {path,method='GET',body={}}=input;
 const url=new URL(path,'http://app');const p=url.pathname;const q=url.searchParams;
 const db=context.supabase,uid=context.userId;
 const roles=required(await db.from('user_roles').select('role').eq('user_id',uid));const role=roles.some(r=>r.role==='admin')?'admin':roles.some(r=>r.role==='driver')?'driver':'rider';
 if(p.startsWith('/api/admin/')&&role!=='admin')throw new Error('Accès administrateur requis');
 if(p.startsWith('/api/drivers/me')&&role!=='driver')throw new Error('Accès chauffeur requis');
 // RLS has verified the role; privileged operations below use only the verified caller identity.
 const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
 const profile=required(await db.from('profiles').select('*').eq('id',uid).single());
 if(p==='/api/users/me'){
  if(method==='PATCH'){const payload={};for(const k of ['name','phone','username'])if(typeof body[k]==='string')payload[k]=body[k].slice(0,100);required(await db.from('profiles').update(payload).eq('id',uid));}
  const fresh=required(await db.from('profiles').select('*').eq('id',uid).single());return {user:{...profileShape(fresh,context.claims.email),role}};
 }
 if(p==='/api/geo/search'){
  const reverse=q.get('reverse')==='1',lat=q.get('lat'),lng=q.get('lng');
  const endpoint=reverse?`https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&lang=fr`:`https://photon.komoot.io/api/?q=${encodeURIComponent(q.get('q')||'')}&limit=6&lang=fr${lat&&lng?`&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`:''}`;
  const res=await fetch(endpoint,{signal:AbortSignal.timeout(10000)});if(!res.ok)throw new Error('Recherche d’adresse indisponible');const j=await res.json();return {results:(j.features||[]).map(f=>{const x=f.properties;return {name:x.name||x.street||x.city,address:[x.name,x.housenumber,x.street,x.postcode,x.city,x.country].filter(Boolean).join(', '),lng:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]}})};
 }
 if(p==='/api/rides/estimate')return estimates(admin,body.pickup,body.dropoff);
 if(p==='/api/drivers/me'){
  if(method==='PATCH'){
   const v=body.vehicle;if(!v||!v.make||!v.model||!v.plate||!DEFAULT_PRICING[v.type]||!Number.isInteger(v.year)||v.year<1990||v.year>2030)throw new Error('Vérifiez les informations du véhicule');
   required(await db.from('drivers').update({vehicle:v}).eq('user_id',uid));
  }
  return {driver:driverShape(required(await db.from('drivers').select('*').eq('user_id',uid).single()))};
 }
 if(p==='/api/drivers/me/status'){
  const d=required(await db.from('drivers').select('*').eq('user_id',uid).single());
  const current=required(await db.from('rides').select('id').eq('driver_id',uid).in('status',active));
  if(!body.online&&current.length)throw new Error('Terminez votre course avant de passer hors ligne');
  if(body.online){if(!d.is_approved)throw new Error('Votre inscription doit être approuvée');if(!d.vehicle.plate)throw new Error('Ajoutez votre véhicule');if(Number(profile.balance)<-25)throw new Error('Régularisez votre solde avant de passer en ligne');if(!body.location||![body.location.lat,body.location.lng].every(Number.isFinite))throw new Error('Position invalide');}
  required(await db.from('drivers').update({is_online:Boolean(body.online),location:body.location||d.location,updated_at:new Date().toISOString()}).eq('user_id',uid));return {ok:true};
 }
 if(p==='/api/drivers/location'){
  if(role!=='driver')throw new Error('Accès refusé');if(![body.lat,body.lng].every(Number.isFinite))throw new Error('Position invalide');
  required(await db.from('drivers').update({location:{lat:body.lat,lng:body.lng,heading:body.heading},updated_at:new Date().toISOString()}).eq('user_id',uid));return {ok:true};
 }
 if(p==='/api/drivers/nearby'){
  const ds=required(await admin.from('drivers').select('id,location,vehicle').eq('is_online',true).eq('is_approved',true));return {drivers:ds.filter(d=>d.location).map(d=>({id:d.id,location:d.location}))};
 }
 if(p==='/api/wallet'){
  if(method==='POST')throw new Error('Les recharges nécessitent un paiement Stripe vérifié.');
  const tx=required(await db.from('wallet_transactions').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(100));return {wallet:{balance:Number(profile.balance),currency:'EUR'},transactions:tx.map(t=>({...t,_id:t.id,amount:Number(t.amount),balanceAfter:Number(t.balance_after),createdAt:t.created_at})),stripeEnabled:Boolean(process.env.STRIPE_SECRET_KEY)};
 }
 if(p==='/api/wallet/checkout'||p==='/api/drivers/me/payouts'){
  const {handlePayments}=await import('./vtc-payments.server');return handlePayments({admin,profile,uid,role,p,q,method,body});
 }
 if(p==='/api/rides'&&method==='POST'){
  if(role!=='rider')throw new Error('Seuls les clients peuvent réserver');if(!DEFAULT_PRICING[body.vehicleType])throw new Error('Gamme invalide');
  const quote=await estimates(admin,body.pickup,body.dropoff);const fare=quote.estimates[body.vehicleType];
  if(quote.route.distanceMeters<100||quote.route.distanceMeters>200000)throw new Error('Le trajet doit être compris entre 100 m et 200 km');
  if(Number(profile.balance)<fare.total)throw new Error('Solde insuffisant : rechargez votre portefeuille');
  const pin=String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,'0');
  const r=required(await admin.from('rides').insert({rider_id:uid,vehicle_type:body.vehicleType,pickup:body.pickup,dropoff:body.dropoff,route:quote.route,fare,pin}).select('*').single());await assignOffer(admin,r);return {ride:await serialize(admin,r,uid)};
 }
 if(p==='/api/rides/active'){
  const list=required(await db.from('rides').select('*').eq(role==='driver'?'driver_id':'rider_id',uid).in('status',active).limit(1));const r=list[0];if(r?.status==='searching'){await assignOffer(admin,r);const fresh=required(await db.from('rides').select('*').eq('id',r.id).single());return {ride:fresh.status==='no_drivers'?null:await serialize(admin,fresh,uid)};}return {ride:await serialize(admin,r,uid)};
 }
 if(p==='/api/drivers/offers'){
  if(role!=='driver')throw new Error('Accès refusé');const rs=required(await admin.from('rides').select('*').eq('status','searching').limit(100));for(const r of rs)await assignOffer(admin,r);
  const r=required(await admin.from('rides').select('*').eq('status','searching').eq('offer_driver_id',uid).limit(1))[0];if(!r)return {offer:null};
  const rider=required(await admin.from('profiles').select('name').eq('id',r.rider_id).single());return {offer:{rideId:r.id,pickup:r.pickup,dropoff:r.dropoff,rider,earnings:r.fare.driverEarnings,distanceMeters:r.route.distanceMeters,durationSeconds:r.route.durationSeconds,surgeMultiplier:r.fare.surgeMultiplier,expiresInSeconds:Math.max(0,Math.ceil((new Date(r.offer_expires_at)-Date.now())/1000)),distanceToPickupMeters:0,etaMinutes:1}};
 }
 if(p==='/api/rides'||p==='/api/admin/rides'){
  const page=Math.max(1,Number(q.get('page'))||1),limit=Math.min(100,Math.max(1,Number(q.get('limit'))||15));let query=(role==='admin'?admin:db).from('rides').select('*',{count:'exact'}).order('created_at',{ascending:false});if(role!=='admin')query=query.eq(role==='driver'?'driver_id':'rider_id',uid);if(q.get('status'))query=query.eq('status',q.get('status'));const res=await query.range((page-1)*limit,page*limit-1);const rows=required(res);return {rides:await Promise.all(rows.map(r=>serialize(admin,r,uid,true))),pagination:{page,pages:Math.ceil(res.count/limit),total:res.count}};
 }
 const match=p.match(/^\/api\/rides\/([^/]+)(?:\/(\w+))?$/);
 if(match){
  const [,id,action]=match;const r=required(await admin.from('rides').select('*').eq('id',id).single());const participant=r.rider_id===uid||r.driver_id===uid;
  if(action==='accept'){
   if(role!=='driver'||r.status!=='searching'||r.offer_driver_id!==uid||new Date(r.offer_expires_at)<new Date())throw new Error('Cette demande n’est plus disponible');
   const claimed=required(await admin.from('rides').update({driver_id:uid,status:'accepted'}).eq('id',id).eq('status','searching').eq('offer_driver_id',uid).select('*'))[0];if(!claimed)throw new Error('Course déjà acceptée');return {ride:await serialize(admin,claimed,uid)};
  }
  if(action==='decline'){if(r.offer_driver_id!==uid||role!=='driver')throw new Error('Accès refusé');required(await admin.from('rides').update({declined:[...r.declined,uid],offer_driver_id:null,offer_expires_at:null}).eq('id',id).eq('offer_driver_id',uid));return {ok:true};}
  if(!participant&&role!=='admin')throw new Error('Course inaccessible');
  if(!action)return {ride:await serialize(admin,r,uid)};
  if(action==='arrive'||action==='start'||action==='complete'){
   const previous={arrive:'accepted',start:'arrived',complete:'in_progress'}[action];if(r.driver_id!==uid||r.status!==previous)throw new Error('Action non autorisée');
   if(action==='start'&&body.pin!==r.pin)throw new Error('Code PIN incorrect');
   if(action==='complete')required(await admin.rpc('settle_ride',{_id:id,_actor:uid}));else required(await admin.from('rides').update({status:action==='arrive'?'arrived':'in_progress',...(action==='arrive'?{arrived_at:new Date().toISOString()}: {})}).eq('id',id).eq('status',previous));
  }else if(action==='cancel'){
   if(!participant||!['searching','accepted','arrived'].includes(r.status))throw new Error('Annulation impossible');
   if(r.driver_id===uid){required(await admin.from('rides').update({status:'searching',driver_id:null,offer_driver_id:null,declined:[...r.declined,uid]}).eq('id',id).eq('status',r.status));}
   else{const patch={status:'cancelled',offer_driver_id:null};if(r.status==='arrived'){required(await admin.rpc('wallet_entry',{_user:uid,_amount:-3,_type:'cancellation_fee',_ride:id}));if(r.driver_id)required(await admin.rpc('wallet_entry',{_user:r.driver_id,_amount:2.76,_type:'ride_earning',_ride:id}));patch.fare={...r.fare,cancellationFee:3};}required(await admin.from('rides').update(patch).eq('id',id).eq('status',r.status));}
  }else if(action==='messages'){
   if(!participant)throw new Error('Accès refusé');if(method==='GET')return {messages:r.messages};if(!['accepted','arrived','in_progress'].includes(r.status)||typeof body.text!=='string'||!body.text.trim()||body.text.length>500)throw new Error('Message invalide');required(await admin.from('rides').update({messages:[...r.messages,{from:r.rider_id===uid?'rider':'driver',text:body.text.trim(),at:new Date().toISOString()}]}).eq('id',id));
  }else if(action==='rate'){
   if(!participant||r.status!=='completed'||!Number.isInteger(body.rating)||body.rating<1||body.rating>5)throw new Error('Note invalide');const field=r.rider_id===uid?'byRider':'byDriver';if(r.rating[field])throw new Error('Course déjà notée');required(await admin.from('rides').update({rating:{...r.rating,[field]:body.rating,[field==='byRider'?'riderComment':'driverComment']:String(body.comment||'').slice(0,500)}}).eq('id',id));
  }else throw new Error('Action inconnue');
  return {ride:await serialize(admin,required(await admin.from('rides').select('*').eq('id',id).single()),uid)};
 }
 if(p==='/api/admin/pricing'){if(method==='PUT'){if(!DEFAULT_PRICING[body.vehicleType]||Object.values(DEFAULT_PRICING[body.vehicleType]).some((_,i)=>!Number.isFinite(body[Object.keys(DEFAULT_PRICING[body.vehicleType])[i]])))throw new Error('Tarif invalide');required(await admin.from('pricing_rules').upsert({vehicle_type:body.vehicleType,rule:body}));return {rule:body};}return {rules:required(await admin.from('pricing_rules').select('*')).map(r=>({...r.rule,vehicleType:r.vehicle_type,city:r.city}))};}
 if(p==='/api/admin/drivers'){if(method==='PATCH'){required(await admin.from('drivers').update({is_approved:Boolean(body.isApproved),...(body.isApproved?{}:{is_online:false})}).eq('id',body.driverId));return {ok:true};}let query=admin.from('drivers').select('*');if(q.get('pending'))query=query.eq('is_approved',false);const ds=required(await query);return {drivers:await Promise.all(ds.map(async d=>({...driverShape(d),userId:required(await admin.from('profiles').select('name,username,avatar').eq('id',d.user_id).single())})))};}
 if(p==='/api/admin/users'){const ps=required(await admin.from('profiles').select('*').limit(100));const rs=required(await admin.from('user_roles').select('*'));return {users:ps.map(p=>({...profileShape(p),role:rs.find(r=>r.user_id===p.id)?.role||'rider'})).filter(p=>(!q.get('role')||p.role===q.get('role'))&&(!q.get('q')||(p.name+' '+p.username).toLowerCase().includes(q.get('q').toLowerCase())))};}
 if(p==='/api/admin/support'){if(method==='PATCH'){if(!['open','resolved'].includes(body.status))throw new Error('Statut invalide');required(await admin.from('contact_messages').update({status:body.status,resolved_at:body.status==='resolved'?new Date().toISOString():null}).eq('id',body.id));return {ok:true};}return {messages:required(await admin.from('contact_messages').select('*').eq('status',q.get('status')||'open')).map(m=>({...m,_id:m.id,createdAt:m.created_at,resolvedAt:m.resolved_at}))};}
 if(p==='/api/drivers/me/earnings'||p==='/api/admin/overview'){
  const rs=required(await (role==='admin'?admin:db).from('rides').select('*').order('created_at',{ascending:false}).limit(1000));const completed=rs.filter(r=>r.status==='completed'),today=new Date().toISOString().slice(0,10);const todayR=completed.filter(r=>r.completed_at?.startsWith(today));const sum=(rows,key)=>rows.reduce((s,r)=>s+Number(r.fare[key]||0),0);
  if(role==='driver'){const d=required(await db.from('drivers').select('*').eq('user_id',uid).single());const mine=completed.filter(r=>r.driver_id===uid);return {wallet:{balance:Number(profile.balance)},stats:d.stats,today:{earnings:sum(mine.filter(r=>r.completed_at?.startsWith(today)),'driverEarnings'),trips:mine.filter(r=>r.completed_at?.startsWith(today)).length},week:{total:sum(mine,'driverEarnings'),trips:mine.length,byDay:[]},recentRides:await Promise.all(mine.slice(0,10).map(r=>serialize(admin,r,uid,true)))};}
  const ps=await admin.from('profiles').select('id',{count:'exact'});const ds=required(await admin.from('drivers').select('*'));return {ridesToday:rs.filter(r=>r.created_at.startsWith(today)).length,activeRides:rs.filter(r=>active.includes(r.status)).length,revenueToday:sum(todayR,'total'),platformFeesToday:sum(todayR,'platformFee'),onlineDrivers:ds.filter(d=>d.is_online).length,pendingDrivers:ds.filter(d=>!d.is_approved).length,totalUsers:ps.count,totalDrivers:ds.length,openSupport:(await admin.from('contact_messages').select('id',{count:'exact'}).eq('status','open')).count,recentRides:await Promise.all(rs.slice(0,10).map(r=>serialize(admin,r,uid,true))),revenue7d:[],statusBreakdown:{completed:completed.length}};
 }
 throw new Error('Ce service n’est pas encore disponible');
}
async function assignOffer(db,r){
 if(r.status!=='searching')return;if(r.offer_driver_id&&new Date(r.offer_expires_at)>new Date())return;
 const declined=[...r.declined,...(r.offer_driver_id?[r.offer_driver_id]:[])];
 const ds=required(await db.from('drivers').select('*').eq('is_online',true).eq('is_approved',true));const busy=required(await db.from('rides').select('driver_id').in('status',['accepted','arrived','in_progress']));
 const d=ds.filter(d=>d.location&&d.vehicle.type===r.vehicle_type&&!declined.includes(d.user_id)&&!busy.some(b=>b.driver_id===d.user_id)).sort((a,b)=>haversineDistance(a.location.lat,a.location.lng,r.pickup.lat,r.pickup.lng)-haversineDistance(b.location.lat,b.location.lng,r.pickup.lat,r.pickup.lng))[0];
 required(await db.from('rides').update(d&&declined.length<8?{offer_driver_id:d.user_id,offer_expires_at:new Date(Date.now()+16000).toISOString(),declined}:{status:'no_drivers',offer_driver_id:null,declined}).eq('id',r.id).eq('status','searching'));
}