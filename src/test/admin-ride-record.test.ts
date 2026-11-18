import {describe,expect,it,vi} from 'vitest';
import {adminRideDateRange,recordPerson} from '../lib/admin-ride-record';
vi.mock('../lib/ride-chat.server',()=>({decodeEvidence:()=>null,CHAT_BUCKET:'private'}));
import {adminRideRecord} from '../lib/admin-ride-record.server';
describe('dossier de course admin',()=>{
  it('filtre les limites réelles du jour de Paris',()=>{
    expect(adminRideDateRange('2026-11-18')).toEqual({from:'2026-11-17T23:00:00.000Z',to:'2026-11-18T23:00:00.000Z'});
    const spring=adminRideDateRange('2026-03-29'),fall=adminRideDateRange('2026-10-25');
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
