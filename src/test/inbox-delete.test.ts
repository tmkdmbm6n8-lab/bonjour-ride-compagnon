import { describe, expect, it } from 'vitest';
import { hideDriverSupportThread } from '../lib/vtc-support.server';
import { newSupportThread, parseSupportThread, supportHiddenForOwner } from '../lib/vtc-support';
const id='11111111-1111-1111-1111-111111111111';
function setup(){
  let row:any={id,topic:'driver_conversation',email:'owner@example.fr',name:'Chauffeur',created_at:'2026-11-18T08:00:00Z',message:JSON.stringify(newSupportThread('owner','Sujet','Message original','2026-11-18T08:00:00Z'))};
  const admin={from:()=>{let patch:any;const q:any={select:()=>q,eq:()=>q,single:async()=>({data:row}),update:(value:any)=>{patch=value;return q},then:(resolve:any)=>{row={...row,...patch};return Promise.resolve({data:[{id}]}).then(resolve)}};return q;}};
  return {admin,get:()=>row};
}
describe('suppression de la boîte chauffeur',()=>{
  it('masque uniquement la copie propriétaire et conserve le contenu admin',async()=>{
    const db=setup();
    await hideDriverSupportThread(db.admin,{uid:'owner',email:'owner@example.fr',id,expectedUpdatedAt:'2026-11-18T08:00:00Z'});
    expect(supportHiddenForOwner(db.get())).toBe(true);
    expect(parseSupportThread(db.get()).messages[0].text).toBe('Message original');
    const thread=parseSupportThread(db.get());thread.messages.push({id:'new',from:'admin',text:'Nouvelle réponse'});
    expect(supportHiddenForOwner({...db.get(),message:JSON.stringify(thread)})).toBe(false);
  });
  it('refuse une autre identité même si l’e-mail est identique',async()=>{
    const db=setup();
    await expect(hideDriverSupportThread(db.admin,{uid:'other',email:'owner@example.fr',id,expectedUpdatedAt:'2026-11-18T08:00:00Z'})).rejects.toThrow('inaccessible');
    expect(supportHiddenForOwner(db.get())).toBe(false);
  });
  it('ne masque pas un message arrivé après la confirmation',async()=>{
    const db=setup();
    await expect(hideDriverSupportThread(db.admin,{uid:'owner',email:'owner@example.fr',id,expectedUpdatedAt:'2026-11-17T08:00:00Z'})).rejects.toThrow('nouveau message');
  });
});
