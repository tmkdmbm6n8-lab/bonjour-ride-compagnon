import {describe,it,expect} from 'vitest';
import {navigationUrl} from '@/lib/navigation';
import {MELODIES} from '@/lib/sounds';
describe('Lancement du GPS chauffeur',()=>{
 it('Google Maps opens driving navigation to the pickup point',()=>expect(navigationUrl('google',{lat:48.5839,lng:7.7455})).toBe('https://www.google.com/maps/dir/?api=1&destination=48.5839,7.7455&travelmode=driving&dir_action=navigate'));
 it('Waze opens navigation to the destination',()=>expect(navigationUrl('waze',{lat:48.585,lng:7.734})).toBe('https://waze.com/ul?ll=48.585,7.734&navigate=yes'));
 it('no link without valid coordinates',()=>expect(navigationUrl('google',{lat:NaN,lng:7})).toBeNull());
});
describe('Sons de notification',()=>{
 it('the ride request sound differs from every rider and message sound',()=>{
  const offer=JSON.stringify(MELODIES.offer);
  for(const k of ['driver-found','arrived','started','message','cancelled','completed'])expect(JSON.stringify(MELODIES[k])).not.toBe(offer);
 });
});
