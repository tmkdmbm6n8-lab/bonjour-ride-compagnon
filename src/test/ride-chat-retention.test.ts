import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendChat, preserveRideChat, closeRideChat, purgeChatFiles, adminChatEvidence, decodeEvidence, chatFileUrl } from '@/lib/ride-chat.server';
import { CHAT_RETENTION_MS } from '@/lib/ride-chat';
function database() {
 const ride:any={id:'ride',rider_id:'rider',driver_id:'driver',status:'in_progress',messages:[{id:'one',type:'text',text:'Bonjour',from:'rider',at:'2026-11-17T10:00:00Z'},{id:'two',type:'audio',path:'ride/audio.webm',from:'driver',at:'2026-11-17T10:01:00Z'},{id:'three',type:'image',path:'ride/image.jpg',from:'rider',at:'2026-11-17T10:02:00Z'},{id:'four',type:'location',lat:48,lng:7,from:'rider',at:'2026-11-17T10:03:00Z'}]};
 const rows:any[]=[],remove=vi.fn(async()=>({data:[],error:null}));
 const admin:any={storage:{from:()=>({remove,createSignedUrl:async(path:string)=>({data:{signedUrl:'private/'+path},error:null})})},from:(table:string)=>{
  const filters:any[]=[],q:any={select:()=>q,limit:()=>q,order:()=>q,eq:(key:string,value:any)=>{filters.push((r:any)=> key==='messages'?JSON.stringify(r[key])===value:r[key]===value);return q},in:(key:string,values:any[])=>{filters.push((r:any)=>values.includes(r[key]));return q},neq:(key:string,value:any)=>{filters.push((r:any)=>JSON.stringify(r[key])!==value);return q},single:()=>{q.singleRow=true;return q},insert:(row:any)=>{q.inserted=row;return q},update:(patch:any)=>{q.patch=patch;return q},delete:()=>{q.deleted=true;return q},then:(resolve:any)=>{
   let selected=(table==='rides'?[ride]:rows).filter(r=>filters.every(fn=>fn(r)));
   if(q.inserted){const value={...q.inserted,id:'archive-'+(rows.length+1),created_at:new Date().toISOString()};rows.push(value);selected=[value]}
   if(q.patch)for(const row of selected)Object.assign(row,q.patch);
   if(q.deleted)for(const row of selected)rows.splice(rows.indexOf(row),1);
   return Promise.resolve({data:q.singleRow?selected[0]:selected,error:null}).then(resolve)
  }};return q;
 }};
 return {admin,ride,rows,remove};
}
beforeEach(()=>{vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','chat-test-key');vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-17T10:05:00Z'))});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs()});
describe('conservation des échanges',()=>{
 it('supprime textes, vocaux, images et positions sans signalement',async()=>{
  const db=database();db.ride.status='completed';await closeRideChat(db.admin,'ride');
  expect(db.ride.messages).toEqual([]);expect(db.remove).toHaveBeenCalledWith(['ride/audio.webm','ride/image.jpg']);expect(db.rows).toEqual([]);
 });
 it('archive tous les types si un signalement précède la fin et ne repousse pas l’échéance',async()=>{
  const db=database();await preserveRideChat(db.admin,'ride','rider');
  const first=decodeEvidence(db.rows[0]);
  vi.advanceTimersByTime(3600000);await preserveRideChat(db.admin,'ride','rider');
  expect(decodeEvidence(db.rows[0]).expiresAt).toBe(first.expiresAt);
  await appendChat(db.admin,'ride','driver',{id:'five',type:'text',text:'Dernier message',from:'driver',at:new Date().toISOString()});
  db.ride.status='completed';await closeRideChat(db.admin,'ride');
  expect(db.ride.messages).toEqual([]);expect(db.remove).not.toHaveBeenCalled();
  expect(decodeEvidence(db.rows[0]).messages).toHaveLength(5);
  vi.setSystemTime(Date.parse(first.reportedAt)+CHAT_RETENTION_MS);await purgeChatFiles(db.admin);
  expect(db.remove).toHaveBeenCalledWith(['ride/audio.webm','ride/image.jpg']);expect(db.rows).toEqual([]);
 });
 it('refuse un signalement tardif ou provenant d’un tiers et refuse les fichiers après clôture',async()=>{
  const db=database();await expect(preserveRideChat(db.admin,'ride','stranger')).rejects.toThrow();
  db.ride.status='completed';await expect(preserveRideChat(db.admin,'ride','rider')).rejects.toThrow();
  await expect(chatFileUrl(db.admin,db.ride,'rider','two')).rejects.toThrow();
 });
 it('ne perd pas les échanges archivés si un ancien instantané arrive après un nouveau',async()=>{
  const db=database();await preserveRideChat(db.admin,'ride','rider');
  await appendChat(db.admin,'ride','rider',{id:'new',type:'text',text:'Nouveau',at:new Date().toISOString()});
  await preserveRideChat(db.admin,'ride','rider');expect(decodeEvidence(db.rows[0]).messages).toHaveLength(5);
 });
 it('conserve une tâche de réessai si la suppression des fichiers échoue',async()=>{
  const db=database();db.ride.status='cancelled';db.remove.mockResolvedValueOnce({data:null,error:{message:'Storage down'}});
  await expect(closeRideChat(db.admin,'ride')).rejects.toThrow('Storage down');
  expect(db.ride.messages).toEqual([]);expect(db.rows).toHaveLength(1);
  await purgeChatFiles(db.admin);expect(db.rows).toEqual([]);
 });
 it('ne présente plus d’archive après expiration',async()=>{
  const db=database();await preserveRideChat(db.admin,'ride','rider');db.ride.status='completed';await closeRideChat(db.admin,'ride');
  const id=db.rows[0].id;vi.advanceTimersByTime(CHAT_RETENTION_MS+1);
  await expect(adminChatEvidence(db.admin,new URLSearchParams({id}))).rejects.toThrow();expect(db.rows).toEqual([]);
 });
});
