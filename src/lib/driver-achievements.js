export const DRIVER_BADGE_TIERS = [
  { threshold:50, name:'Première distinction', motif:'star', accent:'#e3b864', shape:'round' },
  { threshold:100, name:'Étoile confirmée', motif:'double', accent:'#f3d18a', shape:'shield' },
  { threshold:500, name:'Excellence', motif:'laurel', accent:'#ded9ca', shape:'hexagon' },
  { threshold:1000, name:'Prestige', motif:'diamond', accent:'#e8bb3c', shape:'shield' },
  { threshold:5000, name:'Élite', motif:'crown', accent:'#c2d5e5', shape:'round' },
  { threshold:10000, name:'Signature', motif:'wings', accent:'#dfb56e', shape:'hexagon' },
  { threshold:50000, name:'Légende', motif:'legend', accent:'#f8df9c', shape:'royal' },
];
export function driverAchievements(fiveStarCount) {
  const count = Math.max(0, Math.floor(Number(fiveStarCount) || 0));
  const badges = DRIVER_BADGE_TIERS.map((tier) => ({...tier, earned: count >= tier.threshold}));
  const next = badges.find((tier) => !tier.earned);
  return { count, badges, next: next ? {threshold:next.threshold,remaining:next.threshold-count,progress:Math.min(1,count/next.threshold)} : null };
}
