import { describe, expect, it } from 'vitest';
import { createActivityReader } from '@/lib/site-monitoring.server';
function source(values: any[]) {
 const calls: any[] = [];
 const admin = { from(table:string) {
  const call:any={table};calls.push(call);const index=calls.length-1;
  const q:any={select:(columns:string,options:any)=>{call.select={columns,options};return q},eq:(key:string,value:any)=>{call.filter=[key,value];return q},in:(key:string,value:any)=>{call.filter=[key,value];return q},gte:(key:string,value:any)=>{call.since=[key,value];return q},then:(resolve:any)=>Promise.resolve(values[index]).then(resolve)};return q;
 }};return {admin,calls};
}
const counts=(...values:number[])=>values.map(count=>({count,error:null}));
describe('mesures d’activité administrateur',()=>{
 it('compte les lignes sans télécharger les utilisateurs et distingue les objectifs de la capacité',async()=>{
  const db=source(counts(120,63,7,42));let t=0;
  const read=createActivityReader({now:()=>Date.parse('2026-11-17T10:00:00Z'),timer:()=>t+=20});
  const result=await read(db.admin);
  expect(result).toMatchObject({driversOnline:120,activeRides:63,searchingRides:7,completedLastHour:42,activityQueryMs:20,connectedClients:null,infrastructure:{cpuPercent:null,memoryPercent:null,capacityPercent:null},objectives:{drivers:500,clients:10000}});
  expect(db.calls).toHaveLength(4);for(const call of db.calls)expect(call.select.options).toEqual({count:'exact',head:true});
  expect(db.calls[3].since).toEqual(['completed_at','2026-11-17T09:00:00.000Z']);
 });
 it('partage le même relevé entre demandes simultanées et le réutilise dix secondes',async()=>{
  let now=1000;const read=createActivityReader({now:()=>now,timer:()=>0});const db=source(counts(2,1,0,3,4,2,1,6));
  const [a,b]=await Promise.all([read(db.admin),read(db.admin)]);expect(a).toEqual(b);expect(db.calls).toHaveLength(4);
  now+=9999;expect(await read(db.admin)).toEqual(a);expect(db.calls).toHaveLength(4);
  now+=1;expect((await read(db.admin)).driversOnline).toBe(4);expect(db.calls).toHaveLength(8);
 });
 it('ne transforme pas une erreur de base de données en fausses valeurs à zéro et permet un nouvel essai',async()=>{
  const read=createActivityReader();const db=source([{count:null,error:{message:'failure'}},...counts(0,0,0,1,2,3,4)]);
  await expect(read(db.admin)).rejects.toThrow('indisponibles');
  expect((await read(db.admin)).driversOnline).toBe(1);
 });
});
