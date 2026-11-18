import {describe,expect,it,vi} from 'vitest';
vi.mock('../lib/ride-chat.server',()=>({decodeEvidence:()=>null,CHAT_BUCKET:'private'}));
import {adminRideRecord} from '../lib/admin-ride-record.server';
import {adminRideList} from '../lib/admin-ride-list.server';
const id='11111111-1111-1111-1111-111111111111';
const sealedBase={ride_id:id,version:1,sealed_at:'2026-11-18T10:00:00Z',hashValid:true,accounting_expires_at:'2037-01-01',personal_expires_at:'2029-11-18',personal_erased_at:null as string|null,
  accounting:{status:'completed',createdAt:'2026-11-18T09:00:00Z',fare:{total:20},payment:{method:'cash'},riderId:'r',driverId:'d',walletTransactions:[]},
  contacts:{rider:{id:'r',name:'Ancien Nom',phone:'+33600000000'},driver:{id:'d',name:'Chauffeur Époque',phone:'+33611111111'}} as any,
  booking:{pickup:{address:'Adresse historique'},dropoff:{address:'B'},vehicle:{plate:'AA-000-AA',operator:{legalName:'Exploitant Époque'}},documents:[{doc_type:'vtc_register',document_number:'EVTC067',status:'approved'}],waybillSealed:true} as any};
function fakeDb(sealed:any,current:any){
  const tables:string[]=[];
  const q=(table:string):any=>{const self:any={select:()=>self,eq:()=>self,in:()=>self,like:()=>self,order:()=>self,
    limit:async()=>({data:[]}),
    maybeSingle:async()=>({data:table==='rides'?current:table==='profiles'?{id:'r',name:'Nom Actuel',phone:'+33799999999'}:table==='drivers'?{vehicle:{plate:'ZZ-999-ZZ',operator:{legalName:'Exploitant Actuel'}}}:null})};return self;};
  return {tables,rpc:async()=>({data:sealed}),from:(t:string)=>{tables.push(t);return q(t);}};
}
describe('dossier scellé : source unique',()=>{
  it('affiche le prix et l’adresse de l’archive (20 €) même si la course actuelle indique 99 €',async()=>{
    const current={id,status:'completed',created_at:'2026-11-18T09:00:00Z',fare:{total:99},payment:{method:'card'},pickup:{address:'Adresse modifiée'},rider_id:'r',driver_id:'d',messages:[]};
    const db=fakeDb(sealedBase,current);
    const out:any=await adminRideRecord(db,id,'admin','admin-id');
    expect(out.ride.fare.total).toBe(20);
    expect(out.ride.payment.method).toBe('cash');
    expect(out.ride.pickup.address).toBe('Adresse historique');
    expect(out.rider.name).toBe('Ancien Nom');
    expect(out.vehicle.plate).toBe('AA-000-AA');
    expect(out.reservation.operator.legalName).toBe('Exploitant Époque');
    expect(out.reservation.operator.revtc).toBe('EVTC067');
    expect(out.current).toMatchObject({fareTotal:99,differs:true});
    expect(db.tables).not.toContain('profiles');
    expect(db.tables).not.toContain('drivers');
    expect(db.tables).not.toContain('driver_documents');
  });
  it('ne recharge jamais les coordonnées effacées depuis les profils actuels, bulletin compris',async()=>{
    const erased={...sealedBase,personal_erased_at:'2029-11-19T03:15:00Z',contacts:null,booking:null};
    const db=fakeDb(erased,null);
    const out:any=await adminRideRecord(db,id,'admin','admin-id');
    expect(out.rider).toBeNull();
    expect(out.driver).toBeNull();
    expect(out.vehicle).toBeNull();
    expect(out.ride.pickup).toBeNull();
    expect(out.reservation).toBeNull();
    expect(out.archive.personalErased).toBe(true);
    expect(JSON.stringify(out)).not.toContain('+33799999999');
    expect(db.tables).not.toContain('profiles');
  });
  it('ouvre un dossier archivé dont la course a été supprimée',async()=>{
    const out:any=await adminRideRecord(fakeDb(sealedBase,null),id,'admin','admin-id');
    expect(out.archive.rideStillExists).toBe(false);
    expect(out.ride.fare.total).toBe(20);
    expect(out.current).toBeNull();
  });
});
describe('liste admin unifiée courses + archives',()=>{
  it('garde l’ordre de la base, inclut l’archive sans course ni profil et passe le jour de Paris',async()=>{
    const calls:any[]=[];const tables:string[]=[];
    const db:any={rpc:async(name:string,args:any)=>{calls.push([name,args]);return {data:{total:41,rows:[{id:'b',source:'archive',archived:true},{id:'a',source:'ride',archived:true}]}};},
      from:(t:string)=>{tables.push(t);const self:any={select:()=>self,in:async()=>({data:t==='rides'?[{id:'a',status:'completed'}]:[{ride_id:'b',ride_created_at:'2026-11-18T08:00:00Z',final_status:'completed',accounting:{fare:{total:12},vehicleType:'economy',driverId:'d'},contacts:null,booking:null,personal_erased_at:'2029-01-01'}]})};return self;}};
    const out:any=await adminRideList(db,'admin-id',new URLSearchParams({day:'2026-11-18',page:'3',limit:'20'}),async(r:any)=>({_id:r.id,status:r.status}));
    expect(calls[0][0]).toBe('admin_ride_index');
    expect(calls[0][1]).toMatchObject({_actor:'admin-id',_from:'2026-11-17T23:00:00.000Z',_to:'2026-11-18T23:00:00.000Z',_limit:20,_offset:40});
    expect(out.rides.map((r:any)=>r._id)).toEqual(['b','a']);
    expect(out.rides[0]).toMatchObject({source:'archive',fare:{total:12},riderId:{name:'Coordonnées effacées'},pickup:{address:'Adresse effacée'}});
    expect(out.pagination).toEqual({page:3,pages:3,total:41});
    expect(tables).not.toContain('profiles');
  });
});
