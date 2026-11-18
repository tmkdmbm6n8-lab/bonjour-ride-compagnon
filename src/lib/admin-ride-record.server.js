import { recordPerson } from './admin-ride-record.js';
import { visibleChatMessages, CHAT_ACTIVE_STATUSES } from './ride-chat';
import { decodeEvidence, CHAT_BUCKET } from './ride-chat.server';
import { buildWaybill } from './vtc-waybill';
function archivedRide(a){const x=a.accounting||{},b=a.booking||{};return {id:a.ride_id,status:x.status,created_at:x.createdAt,accepted_at:x.acceptedAt,arrived_at:x.arrivedAt,completed_at:x.completedAt,pickup:b.pickup||null,dropoff:b.dropoff||null,vehicle_type:x.vehicleType,route:b.route||{},fare:x.fare,payment:x.payment,rating:b.rating||{},messages:[],rider_id:x.riderId,driver_id:x.driverId,is_test:false};}
function checked(result) { if(result.error)throw new Error(result.error.message);return result.data; }
export async function adminRideRecord(admin, id, role, actor) {
  if(role!=='admin')throw new Error('Accès administrateur requis');
  if(!/^[0-9a-f-]{36}$/i.test(id||''))throw new Error('Référence invalide');
  const sealed=checked(await admin.rpc('admin_ride_archive',{_ride:id,_actor:actor}));
  const current=checked(await admin.from('rides').select('*').eq('id',id).maybeSingle());
  const ride=current||(sealed&&archivedRide(sealed));
  if(!ride)throw new Error('Course introuvable');
  const [rider,driver,vehicle,documents,related]=await Promise.all([
    admin.from('profiles').select('id,name,phone,username').eq('id',ride.rider_id).maybeSingle(),
    ride.driver_id?admin.from('profiles').select('id,name,phone,username').eq('id',ride.driver_id).maybeSingle():{data:null},
    ride.driver_id?admin.from('drivers').select('vehicle').eq('user_id',ride.driver_id).maybeSingle():{data:null},
    ride.driver_id?admin.from('driver_documents').select('doc_type,document_number,status').eq('user_id',ride.driver_id).in('doc_type',['company','vtc_register']):{data:[]},
    admin.from('contact_messages').select('id,topic,message,created_at').in('topic',['payments','ride_chat_archive']).like('message',`%${id}%`).order('created_at',{ascending:false}).limit(100),
  ]);
  const client=sealed?.contacts?recordPerson(sealed.contacts.rider):recordPerson(checked(rider)), chauffeur=sealed?.contacts?recordPerson(sealed.contacts.driver):recordPerson(checked(driver));
  const car=(sealed?.booking?sealed.booking.vehicle:checked(vehicle)?.vehicle) || null, docs=checked(documents)||[], contacts=checked(related)||[];
  const archives=contacts.filter(row=>row.topic==='ride_chat_archive').map(decodeEvidence).filter(row=>row?.rideId===id && Date.parse(row.expiresAt)>Date.now());
  const liveMessages = CHAT_ACTIVE_STATUSES.includes(ride.status) ? visibleChatMessages(ride.messages) : [];
  const liveIds = new Set(liveMessages.map(message=>message.id));
  const messages=[...new Map([...liveMessages,...archives.flatMap(row=>visibleChatMessages(row.messages))].map(message=>[message.id,message])).values()];
  const media=await Promise.all(messages.map(async(message)=>{
    const clean={id:message.id,from:message.from,type:message.type||'text',text:message.text,at:message.at,lat:message.lat,lng:message.lng};
    if(['audio','image'].includes(message.type)&&typeof message.path==='string'&&message.path.startsWith(`${id}/`)&&!message.path.includes('..')) {
      const expiry = liveIds.has(message.id) ? Date.now()+60000 : Math.max(...archives.filter(row=>visibleChatMessages(row.messages).some(item=>item.id===message.id)).map(row=>Date.parse(row.expiresAt)));
      const ttl = Math.max(1,Math.min(60,Math.floor((expiry-Date.now())/1000)));
      const signed=await admin.storage.from(CHAT_BUCKET).createSignedUrl(message.path,ttl);
      return {...clean,url:signed.error?null:signed.data.signedUrl};
    }
    return clean;
  }));
  return {ride:{id:ride.id,status:ride.status,createdAt:ride.created_at,acceptedAt:ride.accepted_at,arrivedAt:ride.arrived_at,completedAt:ride.completed_at,pickup:ride.pickup,dropoff:ride.dropoff,vehicleType:ride.vehicle_type,route:ride.route,fare:ride.fare,payment:ride.payment,rating:ride.rating,isTest:ride.is_test},
    rider:client,driver:chauffeur,vehicle:car,messages:media,
    reservation:buildWaybill(ride,client,car?.operator,docs),
    invoiceRequests:contacts.filter(row=>row.topic==='payments'&&row.message.startsWith(`Demande de facture — course ${id}.`)).map(row=>({id:row.id,createdAt:row.created_at})),
    archive:sealed?{immutable:true,version:sealed.version,sealedAt:sealed.sealed_at,hashValid:sealed.hashValid,accountingExpiresAt:sealed.accounting_expires_at,personalExpiresAt:sealed.personal_expires_at,personalErased:!!sealed.personal_erased_at,profileSource:sealed.contacts?'archive':'erased',walletTransactions:sealed.accounting.walletTransactions||[],messagesAvailable:media.length>0}
      :{immutable:false,profileSource:'current',messagesAvailable:media.length>0},
  };
}
