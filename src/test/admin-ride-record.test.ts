import {describe,expect,it,vi} from 'vitest';
import {adminRideDateRange,recordPerson} from '../lib/admin-ride-record';
vi.mock('../lib/ride-chat.server',()=>({decodeEvidence:()=>null,CHAT_BUCKET:'private'}));
import {adminRideRecord} from '../lib/admin-ride-record.server';
describe('dossier de course admin',()=>{
  it('filtre les limites réelles du jour de Paris',()=>{
    expect(adminRideDateRange('2026-11-18')).toEqual({from:'2026-11-17T23:00:00.000Z',to:'2026-11-18T23:00:00.000Z'});
    const spring=adminRideDateRange('2026-03-29') as {from:string,to:string},fall=adminRideDateRange('2026-10-25') as {from:string,to:string};
    expect(Date.parse(spring.to)-Date.parse(spring.from)).toBe(23*3600000);
    expect(Date.parse(fall.to)-Date.parse(fall.from)).toBe(25*3600000);
    expect(()=>adminRideDateRange('2026-02-30')).toThrow();
  });
  it('conserve le nom et le téléphone déclarés sans inventer de prénom',()=>{
    expect(recordPerson({id:'p',name:'Nom Déclaré Complet',phone:'+33612345678',username:'p',secret:'hidden'})).toEqual({id:'p',name:'Nom Déclaré Complet',phone:'+33612345678',username:'p'});
    expect(recordPerson(null)).toBeNull();
  });
  it('refuse un non-admin avant tout accès aux données privées',async()=>{
    const from=vi.fn();await expect(adminRideRecord({from},'11111111-1111-1111-1111-111111111111','driver')).rejects.toThrow('administrateur');expect(from).not.toHaveBeenCalled();
  });
  it('refuse une référence invalide avant de lire une archive',async()=>{
    const from=vi.fn();await expect(adminRideRecord({from},'not-a-ride','admin')).rejects.toThrow('Référence');expect(from).not.toHaveBeenCalled();
  });
});
describe('dossier scellé',()=>{
  it('affiche les coordonnées figées de l’archive, pas celles du profil actuel',async()=>{
    const id='11111111-1111-1111-1111-111111111111';
    const sealed={ride_id:id,version:1,sealed_at:'2026-11-18T10:00:00Z',hashValid:true,accounting_expires_at:'2037-01-01',personal_expires_at:'2029-11-18',personal_erased_at:null,
      accounting:{status:'completed',createdAt:'2026-11-18T09:00:00Z',fare:{total:20},payment:{method:'cash'},riderId:'r',driverId:null,walletTransactions:[]},
      contacts:{rider:{id:'r',name:'Ancien Nom',phone:'+33600000000'},driver:null},booking:{pickup:{address:'A'},dropoff:{address:'B'},vehicle:null}};
    const q:any={select:()=>q,eq:()=>q,in:()=>q,like:()=>q,order:()=>q,limit:async()=>({data:[]}),maybeSingle:async()=>({data:null})};
    const out:any=await adminRideRecord({rpc:async()=>({data:sealed}),from:()=>q},id,'admin','admin-id');
    expect(out.rider.name).toBe('Ancien Nom');
    expect(out.archive.immutable).toBe(true);
    expect(out.ride.fare.total).toBe(20);
  });
});
