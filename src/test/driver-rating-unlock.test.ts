import { describe, expect, it } from 'vitest';
import { claimRatingCelebration } from '../lib/driver-rating-unlock.server';
function database(count: number, priority = false, collide = false) {
  const state = { driver: { stats: { totalEarnings: 123 } as any, is_priority: priority }, writes: 0, reads: 0 };
  const admin = { from(table: string) {
    let patch: any, expected: string;
    const q: any = {
      select: () => q, eq: (key: string, value: any) => { if (key === 'stats') expected = value; return q; },
      not: () => q, lte: () => q, order: () => q,
      single: async () => ({data:structuredClone(state.driver)}),
      limit: async () => { state.reads++; return {data:Array.from({length:count},()=>({rating:{byRider:5}}))}; },
      update: (value: any) => { patch=value; return q; },
      then: (resolve: any) => {
        state.writes++;
        if (collide && state.writes===1) { state.driver.stats.onlineTime={days:{'2026-11-18':60}}; return Promise.resolve({data:[]}).then(resolve); }
        expect(expected).toBe(JSON.stringify(state.driver.stats));
        state.driver.stats=patch.stats;
        return Promise.resolve({data:[{user_id:'driver'}]}).then(resolve);
      },
    };
    return q;
  }};
  return {admin,state};
}
describe('animation unique du déblocage réel', () => {
  it('ne consomme pas le déblocage à 49 notes', async () => {
    const {admin,state}=database(49);
    expect(await claimRatingCelebration(admin,'driver')).toEqual({celebrate:false});
    expect(state.writes).toBe(0);
  });
  it('mémorise une fois sur le compte, puis refuse les répétitions', async () => {
    const {admin,state}=database(50);
    expect(await claimRatingCelebration(admin,'driver')).toEqual({celebrate:true});
    expect(await claimRatingCelebration(admin,'driver')).toEqual({celebrate:false});
    expect(state.writes).toBe(1);
    expect(state.driver.stats.totalEarnings).toBe(123);
  });
  it('respecte les prioritaires et préserve les mises à jour concurrentes', async () => {
    const priority=database(50,true);
    expect(await claimRatingCelebration(priority.admin,'driver')).toEqual({celebrate:false});
    expect(priority.state.reads).toBe(0);
    const {admin,state}=database(50,false,true);
    expect(await claimRatingCelebration(admin,'driver')).toEqual({celebrate:true});
    expect(state.driver.stats.onlineTime.days['2026-11-18']).toBe(60);
  });
});
