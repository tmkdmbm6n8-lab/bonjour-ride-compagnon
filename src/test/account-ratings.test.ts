import { describe, expect, it } from 'vitest';
import { accountRatingSummary } from '../lib/account-ratings';
import { accountRating } from '../lib/account-ratings.server';
describe('notes strictement séparées par rôle',()=>{
  it('les notes données au chauffeur ne deviennent pas des notes passager',()=>{
    const rows=Array.from({length:500},()=>({rating:{byRider:5}}));
    expect(accountRatingSummary(rows,'driver')).toEqual({average:5,count:500});
    expect(accountRatingSummary(rows,'rider')).toEqual({average:null,count:0});
  });
  it('ignore les notes inverses et invalides',()=>{
    const rows=[{rating:{byRider:5,byDriver:2}},{rating:{byDriver:4}},{rating:{byDriver:6}}];
    expect(accountRatingSummary(rows,'rider')).toEqual({average:3,count:2});
    expect(accountRatingSummary(rows,'driver')).toEqual({average:5,count:1});
  });
  it.each(['driver','rider'])('filtre les courses par le rôle %s côté serveur',async(mode)=>{
    const filters:any[]=[];
    const q:any={select:()=>q,eq:(...args:any[])=>{filters.push(args);return q},not:()=>q,order:()=>q,limit:async()=>({data:[]})};
    await accountRating({from:()=>q},'same-user',mode);
    expect(filters).toContainEqual([mode==='driver'?'driver_id':'rider_id','same-user']);
    expect(filters).toContainEqual(['is_test',false]);
  });
});
