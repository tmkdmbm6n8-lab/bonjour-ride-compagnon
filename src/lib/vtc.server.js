import {DEFAULT_PRICING,calculateFare,settleDriverEarnings,paymentMethodOf,bookingPaymentProblem} from './vtc-pricing';
import {haversineDistance} from './utils/geo';
import {planDispatch,canSeeOffer,distanceToPickupKm,approachSecondsFor,profitability,TEST_OFFER_SECONDS} from './vtc-dispatch';
import {LOWER_CLASSES,isVehicleClass,driverClass,sanitizeAcceptedClasses,isLowerClassRide,availabilityByClass} from './vtc-classes';
import {DOCUMENTS_BUCKET,documentSpec,validateDocumentInput,driverCompliance,complianceProblem} from './vtc-documents';
const active=['searching','accepted','arrived','in_progress'];
function required(result){if(result.error)throw new Error(result.error.message);return result.data;}
function driverShape(d){if(!d)return null;const vc=driverClass(d);return {...d,vehicle:{...(d.vehicle||{}),type:vc},_id:d.id,isOnline:d.is_online,isApproved:d.is_approved,isPriority:Boolean(d.is_priority),userId:d.user_id,vehicleClass:vc,acceptsClasses:sanitizeAcceptedClasses(vc,d.accepts_classes),lowerClasses:LOWER_CLASSES[vc]};}
function docShape(d){return {id:d.id,type:d.doc_type,fileName:d.file_name,number:d.document_number,referenceDate:d.reference_date,validUntil:d.valid_until,status:d.status,rejectionReason:d.rejection_reason,uploadedAt:d.uploaded_at,reviewedAt:d.reviewed_at};}
function profileShape(p,email){return {...p,_id:p.id,createdAt:p.created_at,email:email||'',wallet:{balance:Number(p.balance),currency:'EUR'}};}
async function serialize(db,r,actor,raw=false){
 if(!r)return null;
 let driver;
 if(r.driver_id){const p=required(await db.from('profiles').select('*').eq('id',r.driver_id).single());const d=required(await db.from('drivers').select('*').eq('user_id',r.driver_id).single());driver={id:p.id,name:p.name,avatar:p.avatar,rating:p.rating.average,totalTrips:d.stats.totalTrips,vehicle:{...d.vehicle,type:driverClass(d)},location:d.location};}
 const out={...r,id:r.id,_id:r.id,createdAt:r.created_at,completedAt:r.completed_at,vehicleType:r.vehicle_type,driver,pin:r.rider_id===actor||r.is_test?r.pin:undefined,isTest:Boolean(r.is_test)};
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
 if(p==='/api/users/me/export'){
  // Droit d'accès et de portabilité (RGPD art. 15 et 20) : toutes les données liées au compte.
  const driver=role==='driver'?required(await db.from('drivers').select('*').eq('user_id',uid).maybeSingle()):null;
  const rides=required(await db.from('rides').select('*').or(`rider_id.eq.${uid},driver_id.eq.${uid}`).order('created_at',{ascending:false}).limit(5000)).map(({pin,offer_driver_id,offer_expires_at,declined,...rest})=>rest);
  const transactions=required(await db.from('wallet_transactions').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(10000));
  const documents=role==='driver'?required(await db.from('driver_documents').select('*').eq('user_id',uid)).map(docShape):undefined;
  return {exportedAt:new Date().toISOString(),account:{email:context.claims.email||'',role,consent:context.claims.user_metadata?.consent||null},profile,driver,documents,rides,walletTransactions:transactions};
 }
 if(p==='/api/users/me/deletion-request'&&method==='POST'){
  // Droit à l'effacement (RGPD art. 17) : demande enregistrée et traitée sous un mois.
  required(await admin.from('contact_messages').insert({name:profile.name||profile.username||'Utilisateur',email:context.claims.email||'',topic:'data_request',message:`Demande de suppression du compte ${uid} (${role}). ${String(body.reason||'').slice(0,1000)}`.trim()}));
  return {ok:true};
 }
 if(p==='/api/users/me'){
  if(method==='PATCH'){const payload={};for(const k of ['name','phone','username'])if(typeof body[k]==='string')payload[k]=body[k].slice(0,100);required(await db.from('profiles').update(payload).eq('id',uid));}
  const fresh=required(await db.from('profiles').select('*').eq('id',uid).single());return {user:{...profileShape(fresh,context.claims.email),role}};
 }
 if(p==='/api/geo/search'){
  // Photon (OpenStreetMap) — service gratuit, sans clé, comme dans l'archive d'origine
  const PHOTON_BASE='https://photon.komoot.io';
  const reverse=q.get('reverse')==='1',lat=parseFloat(q.get('lat')),lng=parseFloat(q.get('lng')),text=(q.get('q')||'').trim();
  let endpoint;
  if(reverse){
   if(!Number.isFinite(lat)||!Number.isFinite(lng))throw new Error('Latitude et longitude requises');
   endpoint=`${PHOTON_BASE}/reverse?lon=${lng}&lat=${lat}&limit=1&lang=fr`;
  }else{
   if(text.length<2)return {results:[]};
   endpoint=`${PHOTON_BASE}/api/?q=${encodeURIComponent(text)}&limit=6&lang=fr`;
   if(Number.isFinite(lat)&&Number.isFinite(lng))endpoint+=`&lat=${lat}&lon=${lng}&zoom=14&location_bias_scale=0.4`;
  }
  let res;
  try{res=await fetch(endpoint,{signal:AbortSignal.timeout(5000),headers:{'User-Agent':'strasdrive/1.0'}});}catch{throw new Error('La recherche d’adresse est momentanément indisponible');}
  if(!res.ok)throw new Error('La recherche d’adresse est momentanément indisponible');
  const j=await res.json();
  return {results:(j.features||[]).map(f=>{const x=f.properties||{};const parts=[x.name,x.street,x.housenumber,x.district,x.city,x.state,x.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);return {name:x.name||x.street||'Lieu inconnu',address:parts.join(', '),lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],type:x.osm_value||x.type||''};})};
 }
 if(p==='/api/rides/estimate')return estimates(admin,body.pickup,body.dropoff);
 if(p==='/api/drivers/me'){
  if(method==='PATCH'){
   const cur=required(await db.from('drivers').select('vehicle_class').eq('user_id',uid).single());
   // La gamme est attribuée par StrasDrive : le chauffeur ne peut pas la changer lui-même.
   const v={...(body.vehicle||{}),type:driverClass(cur)};if(!v.make||!v.model||!v.plate||!Number.isInteger(v.year)||v.year<1990||v.year>2030)throw new Error('Vérifiez les informations du véhicule');
   required(await db.from('drivers').update({vehicle:v}).eq('user_id',uid));
  }
  return {driver:driverShape(required(await db.from('drivers').select('*').eq('user_id',uid).single()))};
 }
 if(p==='/api/drivers/me/classes'&&method==='PATCH'){
  const cur=required(await db.from('drivers').select('vehicle_class').eq('user_id',uid).single());const own=driverClass(cur);
  const wanted=Array.isArray(body.acceptsClasses)?body.acceptsClasses:[];
  if(wanted.some(c=>!(LOWER_CLASSES[own]||[]).includes(c)))throw new Error('Vous ne pouvez accepter que des courses de gamme inférieure autorisée pour votre véhicule');
  required(await admin.from('drivers').update({accepts_classes:sanitizeAcceptedClasses(own,wanted)}).eq('user_id',uid));
  return {driver:driverShape(required(await db.from('drivers').select('*').eq('user_id',uid).single()))};
 }
 if(p==='/api/drivers/me/documents'){
  if(method==='POST'){
   const spec=documentSpec(body.type);if(!spec)throw new Error('Type de document inconnu');
   const fields=validateDocumentInput(body.type,body);
   const path=String(body.path||'');if(!path.startsWith(`${uid}/`)||path.includes('..')||path.length>200)throw new Error('Fichier invalide');
   const check=await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path,10);if(check.error)throw new Error('Fichier introuvable, renvoyez-le');
   const previous=required(await admin.from('driver_documents').select('file_path').eq('user_id',uid).eq('doc_type',spec.type).maybeSingle());
   required(await admin.from('driver_documents').upsert({user_id:uid,doc_type:spec.type,file_path:path,file_name:String(body.fileName||'').slice(0,150),...fields,status:'pending',rejection_reason:'',uploaded_at:new Date().toISOString(),reviewed_at:null},{onConflict:'user_id,doc_type'}));
   // Le document remplacé est supprimé immédiatement (minimisation RGPD).
   if(previous&&previous.file_path!==path)await admin.storage.from(DOCUMENTS_BUCKET).remove([previous.file_path]);
  }
  const docs=required(await db.from('driver_documents').select('*').eq('user_id',uid));
  const c=driverCompliance(docs);return {documents:docs.map(docShape),compliance:{...c,problem:complianceProblem(c)}};
 }
 if(p==='/api/drivers/me/status'){
  const d=required(await db.from('drivers').select('*').eq('user_id',uid).single());
  const current=required(await db.from('rides').select('id').eq('driver_id',uid).in('status',active));
  if(!body.online&&current.length)throw new Error('Terminez votre course avant de passer hors ligne');
  if(body.online){if(!d.is_approved)throw new Error('Votre inscription doit être approuvée');if(!d.vehicle.plate)throw new Error('Ajoutez votre véhicule');if(!d.documents_override){const dc=driverCompliance(required(await db.from('driver_documents').select('doc_type,status,valid_until').eq('user_id',uid)));if(!dc.canDrive)throw new Error(`${complianceProblem(dc)} — mettez à jour vos documents dans votre profil`);}if(Number(profile.balance)<-25)throw new Error('Régularisez votre solde avant de passer en ligne');if(!body.location||![body.location.lat,body.location.lng].every(Number.isFinite))throw new Error('Position invalide');}
  required(await db.from('drivers').update({is_online:Boolean(body.online),location:body.location||d.location,updated_at:new Date().toISOString()}).eq('user_id',uid));return {ok:true};
 }
 if(p==='/api/drivers/location'){
  if(role!=='driver')throw new Error('Accès refusé');if(![body.lat,body.lng].every(Number.isFinite))throw new Error('Position invalide');
  required(await db.from('drivers').update({location:{lat:body.lat,lng:body.lng,heading:body.heading},updated_at:new Date().toISOString()}).eq('user_id',uid));return {ok:true};
 }
 if(p==='/api/drivers/nearby'){
  const ds=await dispatchPool(admin);const lat=parseFloat(q.get('lat')),lng=parseFloat(q.get('lng'));const at=Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
  return {drivers:ds.filter(d=>d.location).map(d=>({id:d.id,location:d.location})),availability:availabilityByClass(ds,at)};
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
  const paymentMethod=paymentMethodOf(body.paymentMethod);const payProblem=bookingPaymentProblem(paymentMethod,profile.balance,fare.total);if(payProblem)throw new Error(payProblem);
  const pin=String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,'0');
  const r=required(await admin.from('rides').insert({rider_id:uid,vehicle_type:body.vehicleType,pickup:body.pickup,dropoff:body.dropoff,route:quote.route,fare,pin,payment:{method:paymentMethod}}).select('*').single());await assignOffer(admin,r);return {ride:await serialize(admin,r,uid)};
 }
 if(p==='/api/rides/active'){
  const list=required(await db.from('rides').select('*').eq(role==='driver'?'driver_id':'rider_id',uid).in('status',active).limit(1));const r=list[0];if(r?.status==='searching'){const fresh=await assignOffer(admin,r);return {ride:fresh.status==='no_drivers'?null:await serialize(admin,fresh,uid)};}return {ride:await serialize(admin,r,uid)};
 }
 if(p==='/api/drivers/offers'){
  if(role!=='driver')throw new Error('Accès refusé');const pool=await dispatchPool(admin);let me=pool.find(d=>d.user_id===uid);
  const test=await pendingTestOffer(admin,uid);
  const rs=required(await admin.from('rides').select('*').eq('status','searching').eq('is_test',false).limit(100));const fresh=[];for(const r of rs)fresh.push(await assignOffer(admin,r,pool));
  let r=fresh.filter(x=>canSeeOffer(x,me)).sort((a,b)=>distanceToPickupKm(a,me)-distanceToPickupKm(b,me))[0];if(test){r=test.ride;me=me||test.driver;}if(!r)return {offer:null};
  const approachKm=distanceToPickupKm(r,me),approachMeters=Number.isFinite(approachKm)?Math.round(approachKm*1350):null;
  let profit=null;if(me.is_priority&&approachMeters!=null){const approachSeconds=approachSecondsFor(approachMeters),tripSeconds=r.route.durationSeconds||0;const expected=settleDriverEarnings(r.fare,r.route.distanceMeters,approachSeconds+tripSeconds).driverEarnings;profit={...profitability(expected,approachSeconds,tripSeconds),expectedEarnings:expected,approachSeconds:Math.round(approachSeconds)};}
  const rider=required(await admin.from('profiles').select('name').eq('id',r.rider_id).single());return {offer:{rideId:r.id,pickup:r.pickup,dropoff:r.dropoff,rider,earnings:r.fare.driverEarnings,distanceMeters:r.route.distanceMeters,durationSeconds:r.route.durationSeconds,surgeMultiplier:r.fare.surgeMultiplier,expiresInSeconds:Math.max(0,Math.ceil((new Date(r.offer_expires_at)-Date.now())/1000)),phase:r.dispatch_phase,isPriority:Boolean(me.is_priority),rideClass:r.vehicle_type,ownClass:driverClass(me),lowerClass:isLowerClassRide(me,r.vehicle_type),distanceToPickupMeters:approachMeters??0,etaMinutes:approachMeters==null?1:Math.max(1,Math.round(approachSecondsFor(approachMeters)/60)),profitability:profit,isTest:Boolean(r.is_test),testPin:r.is_test?r.pin:undefined,paymentMethod:paymentMethodOf(r.payment?.method),total:r.fare.total}};
 }
 if(p==='/api/rides'||p==='/api/admin/rides'){
  const page=Math.max(1,Number(q.get('page'))||1),limit=Math.min(100,Math.max(1,Number(q.get('limit'))||15));let query=(role==='admin'?admin:db).from('rides').select('*',{count:'exact'}).order('created_at',{ascending:false});if(role!=='admin')query=query.eq(role==='driver'?'driver_id':'rider_id',uid);if(q.get('status'))query=query.eq('status',q.get('status'));const res=await query.range((page-1)*limit,page*limit-1);const rows=required(res);return {rides:await Promise.all(rows.map(r=>serialize(admin,r,uid,true))),pagination:{page,pages:Math.ceil(res.count/limit),total:res.count}};
 }
 const match=p.match(/^\/api\/rides\/([^/]+)(?:\/(\w+))?$/);
 if(match){
  const [,id,action]=match;const r=required(await admin.from('rides').select('*').eq('id',id).single());const participant=r.rider_id===uid||r.driver_id===uid;
  if(action==='accept'){
   if(r.is_test){if(role!=='driver'||r.status!=='searching'||r.offer_driver_id!==uid||!r.offer_expires_at||new Date(r.offer_expires_at).getTime()<=Date.now())throw new Error('Cette demande n’est plus disponible');}
   else{const me=role==='driver'?(await dispatchPool(admin)).find(d=>d.user_id===uid):null;if(!canSeeOffer(r,me))throw new Error('Cette demande n’est plus disponible');}
   let claim=admin.from('rides').update({driver_id:uid,status:'accepted',accepted_at:new Date().toISOString(),offer_driver_id:null,offer_expires_at:null}).eq('id',id).eq('status','searching').eq('dispatch_phase',r.dispatch_phase);if(r.dispatch_phase==='nearest')claim=claim.eq('offer_driver_id',uid);
   const claimed=required(await claim.select('*'))[0];if(!claimed)throw new Error('Course déjà acceptée');return {ride:await serialize(admin,claimed,uid)};
  }
  if(action==='decline'){if(role!=='driver')throw new Error('Accès refusé');required(await admin.rpc('decline_ride_offer',{_ride:id,_driver:uid}));return {ok:true};}
  if(!participant&&role!=='admin')throw new Error('Course inaccessible');
  if(!action)return {ride:await serialize(admin,r,uid)};
  if(action==='arrive'||action==='start'||action==='complete'){
   const previous={arrive:'accepted',start:'arrived',complete:'in_progress'}[action];if(r.driver_id!==uid||r.status!==previous)throw new Error('Action non autorisée');
   if(action==='start'&&body.pin!==r.pin)throw new Error('Code PIN incorrect');
   if(action==='complete'&&r.is_test){required(await admin.from('rides').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',id).eq('status','in_progress'));}
   else if(action==='complete'){const since=new Date(r.accepted_at||r.arrived_at||r.created_at).getTime();const activitySeconds=Math.max(0,(Date.now()-since)/1000);const fare=settleDriverEarnings(r.fare,r.route.distanceMeters,activitySeconds);required(await admin.from('rides').update({fare}).eq('id',id).eq('status','in_progress'));required(await admin.rpc('settle_ride',{_id:id,_actor:uid}));}else required(await admin.from('rides').update({status:action==='arrive'?'arrived':'in_progress',...(action==='arrive'?{arrived_at:new Date().toISOString()}: {})}).eq('id',id).eq('status',previous));
  }else if(action==='cancel'){
   if(!participant||!['searching','accepted','arrived'].includes(r.status))throw new Error('Annulation impossible');
   if(r.driver_id===uid){required(await admin.from('rides').update({status:'searching',driver_id:null,offer_driver_id:null,offer_expires_at:null,dispatch_phase:null,accepted_at:null,declined:[...r.declined,uid]}).eq('id',id).eq('status',r.status));}
   else{const patch={status:'cancelled',offer_driver_id:null};if(r.status==='arrived'&&!r.is_test&&paymentMethodOf(r.payment?.method)!=='cash'){required(await admin.rpc('wallet_entry',{_user:uid,_amount:-3,_type:'cancellation_fee',_ride:id}));if(r.driver_id)required(await admin.rpc('wallet_entry',{_user:r.driver_id,_amount:2.76,_type:'ride_earning',_ride:id}));patch.fare={...r.fare,cancellationFee:3};}required(await admin.from('rides').update(patch).eq('id',id).eq('status',r.status));}
  }else if(action==='messages'){
   if(!participant)throw new Error('Accès refusé');if(method==='GET')return {messages:r.messages};if(!['accepted','arrived','in_progress'].includes(r.status)||typeof body.text!=='string'||!body.text.trim()||body.text.length>500)throw new Error('Message invalide');required(await admin.from('rides').update({messages:[...r.messages,{from:r.rider_id===uid?'rider':'driver',text:body.text.trim(),at:new Date().toISOString()}]}).eq('id',id));
  }else if(action==='rate'){
   if(r.is_test&&participant&&r.status==='completed')return {ride:await serialize(admin,r,uid)};
   if(!participant||r.status!=='completed'||!Number.isInteger(body.rating)||body.rating<1||body.rating>5)throw new Error('Note invalide');const field=r.rider_id===uid?'byRider':'byDriver';if(r.rating[field])throw new Error('Course déjà notée');required(await admin.from('rides').update({rating:{...r.rating,[field]:body.rating,[field==='byRider'?'riderComment':'driverComment']:String(body.comment||'').slice(0,500)}}).eq('id',id));
  }else throw new Error('Action inconnue');
  return {ride:await serialize(admin,required(await admin.from('rides').select('*').eq('id',id).single()),uid)};
 }
 if(p==='/api/admin/test-ride'&&method==='POST'){
  // Fictitious ride sent to one chosen driver only, to test the request notification. No payment, no stats.
  const d=required(await admin.from('drivers').select('*').eq('id',body.driverId).maybeSingle());if(!d)throw new Error('Chauffeur introuvable');
  if(required(await admin.from('rides').select('id').eq('driver_id',d.user_id).in('status',['accepted','arrived','in_progress'])).length)throw new Error('Ce chauffeur est déjà en course');
  required(await admin.from('rides').update({status:'cancelled',dispatch_phase:null,offer_driver_id:null,offer_expires_at:null}).eq('is_test',true).eq('status','searching').eq('offer_driver_id',d.user_id));
  const at=d.location&&Number.isFinite(d.location.lat)&&Number.isFinite(d.location.lng)?d.location:null;
  const pickup=at?{lat:at.lat+0.005,lng:at.lng+0.004,address:'Point de prise en charge test (à ~600 m)'}:{...TEST_PICKUP};
  const dropoff=at?{lat:at.lat-0.012,lng:at.lng+0.022,address:'Destination test (à ~2 km)'}:{...TEST_DROPOFF};
  const cls=driverClass(d);const quote=await estimates(admin,pickup,dropoff);
  const r=required(await admin.from('rides').insert({rider_id:uid,vehicle_type:cls,pickup,dropoff,route:quote.route,fare:quote.estimates[cls],pin:TEST_PIN,is_test:true,dispatch_phase:'nearest',offer_driver_id:d.user_id,offer_expires_at:new Date(Date.now()+TEST_OFFER_SECONDS*1000).toISOString()}).select('id').single());
  return {ok:true,rideId:r.id,expiresInSeconds:TEST_OFFER_SECONDS,driverOnline:Boolean(d.is_online)};
 }
 if(p==='/api/admin/pricing'){if(method==='PUT'){if(!DEFAULT_PRICING[body.vehicleType]||Object.values(DEFAULT_PRICING[body.vehicleType]).some((_,i)=>!Number.isFinite(body[Object.keys(DEFAULT_PRICING[body.vehicleType])[i]])))throw new Error('Tarif invalide');required(await admin.from('pricing_rules').upsert({vehicle_type:body.vehicleType,rule:body}));return {rule:body};}return {rules:required(await admin.from('pricing_rules').select('*')).map(r=>({...r.rule,vehicleType:r.vehicle_type,city:r.city}))};}
 if(p==='/api/admin/drivers/documents'){
  if(method==='PATCH'){
   if(!['approved','rejected'].includes(body.status))throw new Error('Statut invalide');const reason=String(body.reason||'').trim().slice(0,300);if(body.status==='rejected'&&reason.length<3)throw new Error('Indiquez le motif du refus');
   const doc=required(await admin.from('driver_documents').update({status:body.status,rejection_reason:body.status==='rejected'?reason:'',reviewed_at:new Date().toISOString()}).eq('id',body.documentId).select('user_id').single());
   const c=driverCompliance(required(await admin.from('driver_documents').select('doc_type,status,valid_until').eq('user_id',doc.user_id)));
   if(!c.canDrive)required(await admin.from('drivers').update({is_online:false}).eq('user_id',doc.user_id).eq('documents_override',false));
   return {ok:true};
  }
  const d=required(await admin.from('drivers').select('user_id').eq('id',q.get('driverId')).single());
  const docs=required(await admin.from('driver_documents').select('*').eq('user_id',d.user_id));
  const c=driverCompliance(docs);
  return {documents:await Promise.all(docs.map(async x=>({...docShape(x),url:(await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(x.file_path,600)).data?.signedUrl||null}))),compliance:{...c,problem:complianceProblem(c)}};
 }
 if(p==='/api/admin/drivers'){if(method==='PATCH'){if(body.isApproved===true&&body.force!==true){const t=required(await admin.from('drivers').select('user_id').eq('id',body.driverId).single());const c=driverCompliance(required(await admin.from('driver_documents').select('doc_type,status,valid_until').eq('user_id',t.user_id)));if(!c.canBeApproved)throw new Error(`Validation impossible. ${complianceProblem(c)}`);}let patch;if('vehicleClass' in body){if(!isVehicleClass(body.vehicleClass))throw new Error('Gamme invalide');const t=required(await admin.from('drivers').select('accepts_classes,vehicle').eq('id',body.driverId).single());patch={vehicle_class:body.vehicleClass,accepts_classes:sanitizeAcceptedClasses(body.vehicleClass,t.accepts_classes),vehicle:{...(t.vehicle||{}),type:body.vehicleClass}};}else patch='isPriority' in body?{is_priority:Boolean(body.isPriority)}:{is_approved:Boolean(body.isApproved),documents_override:body.isApproved===true&&body.force===true,...(body.isApproved?{}:{is_online:false})};required(await admin.from('drivers').update(patch).eq('id',body.driverId));return {ok:true};}let query=admin.from('drivers').select('*');if(q.get('pending'))query=query.eq('is_approved',false);const ds=required(await query);const allDocs=required(await admin.from('driver_documents').select('user_id,doc_type,status,valid_until'));return {drivers:await Promise.all(ds.map(async d=>({...driverShape(d),documents:(c=>({override:Boolean(d.documents_override),approved:c.approved,required:c.required,canBeApproved:c.canBeApproved,problem:complianceProblem(c)}))(driverCompliance(allDocs.filter(x=>x.user_id===d.user_id))),userId:required(await admin.from('profiles').select('name,username,avatar').eq('id',d.user_id).single())})))};}
 if(p==='/api/admin/users'&&method==='DELETE'){
  // Full erasure chosen by the admin: account, documents, rides, wallet and payment history.
  const target=String(body.userId||'');if(!/^[0-9a-f-]{36}$/i.test(target))throw new Error('Compte invalide');
  if(target===uid)throw new Error('Vous ne pouvez pas supprimer votre propre compte');
  const files=(await admin.storage.from(DOCUMENTS_BUCKET).list(target,{limit:1000})).data||[];
  const removed=required(await admin.rpc('admin_delete_account',{_user:target}));
  if(files.length)await admin.storage.from(DOCUMENTS_BUCKET).remove(files.map(f=>`${target}/${f.name}`));
  const {error}=await admin.auth.admin.deleteUser(target);if(error&&!/not.?found/i.test(error.message))throw new Error(`Données effacées, mais l’accès au compte n’a pas pu être supprimé : ${error.message}`);
  return {ok:true,removed};
 }
 if(p==='/api/admin/users'){const ps=required(await admin.from('profiles').select('*').limit(100));const rs=required(await admin.from('user_roles').select('*'));return {users:ps.map(p=>({...profileShape(p),role:rs.find(r=>r.user_id===p.id)?.role||'rider'})).filter(p=>(!q.get('role')||p.role===q.get('role'))&&(!q.get('q')||(p.name+' '+p.username).toLowerCase().includes(q.get('q').toLowerCase())))};}
 if(p==='/api/admin/support'){if(method==='PATCH'){if(!['open','resolved'].includes(body.status))throw new Error('Statut invalide');required(await admin.from('contact_messages').update({status:body.status,resolved_at:body.status==='resolved'?new Date().toISOString():null}).eq('id',body.id));return {ok:true};}return {messages:required(await admin.from('contact_messages').select('*').eq('status',q.get('status')||'open')).map(m=>({...m,_id:m.id,createdAt:m.created_at,resolvedAt:m.resolved_at}))};}
 if(p==='/api/drivers/me/earnings'||p==='/api/admin/overview'){
  const rs=required(await (role==='admin'?admin:db).from('rides').select('*').eq('is_test',false).order('created_at',{ascending:false}).limit(1000));const completed=rs.filter(r=>r.status==='completed'),today=new Date().toISOString().slice(0,10);const todayR=completed.filter(r=>r.completed_at?.startsWith(today));const sum=(rows,key)=>rows.reduce((s,r)=>s+Number(r.fare[key]||0),0);
  if(role==='driver'){const d=required(await db.from('drivers').select('*').eq('user_id',uid).single());const mine=completed.filter(r=>r.driver_id===uid);return {wallet:{balance:Number(profile.balance)},stats:d.stats,today:{earnings:sum(mine.filter(r=>r.completed_at?.startsWith(today)),'driverEarnings'),trips:mine.filter(r=>r.completed_at?.startsWith(today)).length},week:{total:sum(mine,'driverEarnings'),trips:mine.length,byDay:[]},recentRides:await Promise.all(mine.slice(0,10).map(r=>serialize(admin,r,uid,true)))};}
  const ps=await admin.from('profiles').select('id',{count:'exact'});const ds=required(await admin.from('drivers').select('*'));return {ridesToday:rs.filter(r=>r.created_at.startsWith(today)).length,activeRides:rs.filter(r=>active.includes(r.status)).length,revenueToday:sum(todayR,'total'),platformFeesToday:sum(todayR,'platformFee'),onlineDrivers:ds.filter(d=>d.is_online).length,pendingDrivers:ds.filter(d=>!d.is_approved).length,totalUsers:ps.count,totalDrivers:ds.length,openSupport:(await admin.from('contact_messages').select('id',{count:'exact'}).eq('status','open')).count,recentRides:await Promise.all(rs.slice(0,10).map(r=>serialize(admin,r,uid,true))),revenue7d:[],statusBreakdown:{completed:completed.length}};
 }
 throw new Error('Ce service n’est pas encore disponible');
}
const TEST_PIN='0000';
const TEST_PICKUP={lat:48.5833,lng:7.7458,address:'Place Kléber, 67000 Strasbourg (test)'};
const TEST_DROPOFF={lat:48.5850,lng:7.7342,address:'Gare de Strasbourg, 67000 Strasbourg (test)'};
async function pendingTestOffer(db,uid){
 const busy=required(await db.from('rides').select('id').eq('driver_id',uid).in('status',['accepted','arrived','in_progress']));if(busy.length)return null;
 const ride=required(await db.from('rides').select('*').eq('status','searching').eq('is_test',true).eq('offer_driver_id',uid).gt('offer_expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1))[0];if(!ride)return null;
 return {ride,driver:required(await db.from('drivers').select('*').eq('user_id',uid).single())};
}
async function dispatchPool(db){
 const ds=required(await db.from('drivers').select('*').eq('is_online',true).eq('is_approved',true));
 const busy=new Set(required(await db.from('rides').select('driver_id').in('status',['accepted','arrived','in_progress'])).map(b=>b.driver_id));
 return ds.filter(d=>!busy.has(d.user_id));
}
async function assignOffer(db,r,pool){
 if(r.status!=='searching')return r;
 if(r.is_test){if(r.offer_expires_at&&new Date(r.offer_expires_at).getTime()>Date.now())return r;return required(await db.from('rides').update({status:'no_drivers',dispatch_phase:null,offer_driver_id:null,offer_expires_at:null}).eq('id',r.id).eq('status','searching').select('*'))[0]||r;}
 const patch=planDispatch(r,pool||await dispatchPool(db));if(!patch)return r;
 let q=db.from('rides').update(patch).eq('id',r.id).eq('status','searching');q=r.dispatch_phase?q.eq('dispatch_phase',r.dispatch_phase):q.is('dispatch_phase',null);
 return required(await q.select('*'))[0]||required(await db.from('rides').select('*').eq('id',r.id).single());
}