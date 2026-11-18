import { recordPerson, sealedParts, currentDiff } from './admin-ride-record.js';
import { visibleChatMessages, CHAT_ACTIVE_STATUSES } from './ride-chat';
import { decodeEvidence, CHAT_BUCKET } from './ride-chat.server';
import { buildWaybill } from './vtc-waybill';
function checked(result) { if(result.error)throw new Error(result.error.message);return result.data; }
async function liveParts(admin, ride) {
  const [rider,driver,vehicle,documents]=await Promise.all([
    admin.from('profiles').select('id,name,phone,username').eq('id',ride.rider_id).maybeSingle(),
    ride.driver_id?admin.from('profiles').select('id,name,phone,username').eq('id',ride.driver_id).maybeSingle():{data:null},
    ride.driver_id?admin.from('drivers').select('vehicle').eq('user_id',ride.driver_id).maybeSingle():{data:null},
    ride.driver_id?admin.from('driver_documents').select('doc_type,document_number,status').eq('user_id',ride.driver_id).in('doc_type',['company','vtc_register']):{data:[]},
  ]);
  const car=checked(vehicle)?.vehicle||null;
  return {ride,rider:recordPerson(checked(rider)),driver:recordPerson(checked(driver)),vehicle:car,operator:car?.operator,documents:checked(documents)||[],reservationSource:'current',erased:false};
}
export async function adminRideRecord(admin, id, role, actor) {
  if(role!=='admin')throw new Error('Accès administrateur requis');
  if(!/^[0-9a-f-]{36}$/i.test(id||''))throw new Error('Référence invalide');
  const sealed=checked(await admin.rpc('admin_ride_archive',{_ride:id,_actor:actor}));
  const current=checked(await admin.from('rides').select('*').eq('id',id).maybeSingle());
  if(!sealed&&!current)throw new Error('Course introuvable');
  // Dossier scellé : toutes les données historiques viennent de l'archive ; un champ effacé reste indisponible.
  const parts=sealed?sealedParts(sealed):await liveParts(admin,current);
  const {ride}=parts;
  const contacts=checked(await admin.from('contact_messages').select('id,topic,message,created_at').in('topic',['payments','ride_chat_archive']).like('message',`%${id}%`).order('created_at',{ascending:false}).limit(100))||[];
  const archives=contacts.filter(row=>row.topic==='ride_chat_archive').map(decodeEvidence).filter(row=>row?.rideId===id && Date.parse(row.expiresAt)>Date.now());
  const liveMessages = current && CHAT_ACTIVE_STATUSES.includes(current.status) ? visibleChatMessages(current.messages) : [];
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
  const reservation=parts.erased?null:{...buildWaybill(ride,parts.rider,parts.operator,parts.documents),source:parts.reservationSource};
  return {ride:{id:ride.id,status:ride.status,createdAt:ride.created_at,acceptedAt:ride.accepted_at,arrivedAt:ride.arrived_at,completedAt:ride.completed_at,pickup:ride.pickup,dropoff:ride.dropoff,vehicleType:ride.vehicle_type,route:ride.route,fare:ride.fare,payment:ride.payment,rating:ride.rating,isTest:ride.is_test},
    rider:parts.rider,driver:parts.driver,vehicle:parts.vehicle,messages:media,
    reservation,reservationSource:parts.reservationSource,
    invoiceRequests:contacts.filter(row=>row.topic==='payments'&&row.message.startsWith(`Demande de facture — course ${id}.`)).map(row=>({id:row.id,createdAt:row.created_at})),
    current:sealed?currentDiff(current,ride):undefined,
    archive:sealed?{immutable:true,version:sealed.version,sealedAt:sealed.sealed_at,hashValid:sealed.hashValid,accountingExpiresAt:sealed.accounting_expires_at,personalExpiresAt:sealed.personal_expires_at,personalErased:parts.erased,profileSource:parts.erased?'erased':'archive',rideStillExists:Boolean(current),walletTransactions:sealed.accounting?.walletTransactions||[],messagesAvailable:media.length>0}
      :{immutable:false,profileSource:'current',messagesAvailable:media.length>0},
  };
}
