const RAD = Math.PI / 180;
const METERS = 111195;
export function projectRoute(route, point) {
  if (!route || route.length < 2 || !point) return null;
  const scale = METERS * Math.cos(point.lat * RAD);
  let best = null;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i+1];
    const ax = (a[0]-point.lng)*scale, ay = (a[1]-point.lat)*METERS;
    const dx = (b[0]-a[0])*scale, dy = (b[1]-a[1])*METERS;
    const len = dx*dx+dy*dy;
    if (!len) continue;
    const t = Math.max(0, Math.min(1, -(ax*dx+ay*dy)/len));
    const distance = Math.hypot(ax+t*dx,ay+t*dy);
    if (!best || distance < best.distance) {
      const lng = a[0]+(b[0]-a[0])*t, lat = a[1]+(b[1]-a[1])*t;
      best = {lng,lat,distance,index:i,t};
    }
  }
  return best;
}
export function predictPosition(fix, now) {
  const age = Math.max(0, Math.min(1.2, (now-(fix.timestamp || now))/1000));
  const speed = Number.isFinite(fix.speed) ? Math.max(0,Math.min(55,fix.speed)) : 0;
  const heading = Number.isFinite(fix.heading) ? fix.heading : null;
  if (heading === null || fix.accuracy > 35 || speed < 0.7) return fix;
  const d = speed*age;
  return {...fix,lat:fix.lat+d*Math.cos(heading*RAD)/METERS,lng:fix.lng+d*Math.sin(heading*RAD)/(METERS*Math.cos(fix.lat*RAD))};
}
