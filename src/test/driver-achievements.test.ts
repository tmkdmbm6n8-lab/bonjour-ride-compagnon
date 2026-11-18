import {describe,expect,it} from 'vitest';
import {driverAchievements,DRIVER_BADGE_TIERS,currentAndNextBadge} from '../lib/driver-achievements';
describe('distinctions chauffeur sur les notes cinq étoiles',()=>{
  it('ne montre que le palier actuel et le prochain, sans perdre les acquis',()=>{
    const all=driverAchievements(1000);
    const visible=currentAndNextBadge(all.badges);
    expect(visible.current?.threshold).toBe(1000);
    expect(visible.next?.threshold).toBe(5000);
    expect(all.badges.filter(b=>b.earned)).toHaveLength(4);
    expect(currentAndNextBadge(driverAchievements(0).badges).current).toBeNull();
    expect(currentAndNextBadge(driverAchievements(50000).badges).next).toBeNull();
  });
  it('définit des paliers distincts jusqu’à 50 000',()=>{
    expect(DRIVER_BADGE_TIERS.map(b=>b.threshold)).toEqual([50,100,500,1000,5000,10000,50000]);
    expect(new Set(DRIVER_BADGE_TIERS.map(b=>b.motif)).size).toBe(7);
  });
  it.each(DRIVER_BADGE_TIERS.map(b=>b.threshold))('débloque chaque badge à %s, pas avant',(threshold)=>{
    expect(driverAchievements(threshold-1).badges.find(b=>b.threshold===threshold)?.earned).toBe(false);
    expect(driverAchievements(threshold).badges.find(b=>b.threshold===threshold)?.earned).toBe(true);
  });
  it('ne plafonne pas les distinctions aux 500 notes du tableau des avis',()=>{
    expect(driverAchievements(50000).badges.every(b=>b.earned)).toBe(true);
    expect(driverAchievements(50000).next).toBeNull();
    expect(driverAchievements(49999).next?.remaining).toBe(1);
    expect(driverAchievements(0).badges.some(b=>b.earned)).toBe(false);
  });
});
