import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({
 path:'/driver/menu',fetch:vi.fn(),push:vi.fn(),listeners:new Map<string,Set<any>>(),ring:vi.fn(),stopRing:vi.fn(),stopActivity:vi.fn(),reservations:[] as any[],activity:null as any,
}));
vi.mock('@/lib/archive-auth',()=>({useSession:()=>({status:'authenticated',data:{user:{id:'driver-a',role:'driver',canDrive:true}}})}));
vi.mock('@/lib/archive-navigation',()=>({default:({children}:any)=><>{children}</>,usePathname:()=>fixture.path,useRouter:()=>({push:fixture.push})}));
vi.mock('@/lib/archive-fetch',()=>({apiFetch:(...args:any[])=>fixture.fetch(...args)}));
vi.mock('@/components/ui/Toast',()=>({useToast:()=>vi.fn()}));
vi.mock('@/components/ui/Modal',()=>({default:({open,children,fullScreen}:any)=>open?<div role="dialog" data-fullscreen={String(fullScreen)}>{children}</div>:null}));
vi.mock('@/lib/sounds',()=>({startRinging:()=>{fixture.ring();return fixture.stopRing;},playSound:vi.fn()}));
vi.mock('@/lib/live-activity-native',()=>({syncLiveActivity:vi.fn(),stopLiveActivity:fixture.stopActivity}));
vi.mock('@/context/SocketProvider',()=>({useSocket:()=>({isConnected:true,socket:socket})}));
const socket={on:(event:string,fn:any)=>{if(!fixture.listeners.has(event))fixture.listeners.set(event,new Set());fixture.listeners.get(event)!.add(fn);},off:(event:string,fn:any)=>fixture.listeners.get(event)?.delete(fn),emit:vi.fn()};
import { DriverActivityProvider, useDriverActivity } from '../context/DriverActivityProvider';
function Probe(){fixture.activity=useDriverActivity();return <div>{fixture.activity.loading?'Chargement':fixture.activity.online?'En ligne':'GO'}<span>Page {fixture.path}</span></div>;}
const offer=()=>({rideId:'ride-a',phase:'broadcast',expiresAt:new Date(Date.now()+45000).toISOString(),expiresInSeconds:45,earnings:25,pickup:{address:'Départ test'},dropoff:{address:'Arrivée test'},distanceMeters:5000,durationSeconds:600,distanceToPickupMeters:300,etaMinutes:2,paymentMethod:'cash'});
async function flush(ms=0){await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});}
async function receive(){await act(async()=>{for(const fn of fixture.listeners.get('ride:offer')||[])fn(offer());});await flush();}
describe('persistent driver activity and shared incoming offers',()=>{
 beforeEach(()=>{
  vi.useFakeTimers();vi.clearAllMocks();fixture.listeners.clear();fixture.path='/driver/menu';fixture.reservations=[];
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  fixture.fetch.mockImplementation(async(path:string)=>({ok:true,json:async()=>path==='/api/drivers/me'?{driver:{isOnline:true,isApproved:true,isReportSuspended:false}}:path==='/api/rides/active?view=driver'?{ride:null}:path==='/api/drivers/me/advance-reservations'?{reservations:fixture.reservations}:path.endsWith('/accept')?{ride:{id:'ride-a',status:'accepted'}}:{ok:true}}));
 });
 afterEach(()=>{cleanup();vi.useRealTimers();});
 it('keeps the online status when changing driver tabs without refetching initial state',async()=>{
  const view=render(<DriverActivityProvider><Probe/></DriverActivityProvider>);await flush();
  expect(screen.getByText('En ligne')).toBeTruthy();
  const initialLoads=fixture.fetch.mock.calls.filter(([p])=>p==='/api/rides/active?view=driver').length;
  fixture.path='/driver/reservations';view.rerender(<DriverActivityProvider><Probe/></DriverActivityProvider>);
  expect(screen.getByText('En ligne')).toBeTruthy();expect(screen.queryByText('GO')).toBeNull();
  expect(fixture.fetch.mock.calls.filter(([p])=>p==='/api/rides/active?view=driver')).toHaveLength(initialLoads);
 });
 it('shows a full-screen offer in Menu and navigates only after a successful accept',async()=>{
  render(<DriverActivityProvider><Probe/></DriverActivityProvider>);await flush();await receive();
  expect(screen.getByRole('dialog').getAttribute('data-fullscreen')).toBe('true');
  expect(screen.getByText('Départ test')).toBeTruthy();
  expect(fixture.push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:/Accepter/}));await flush();
  expect(fixture.fetch).toHaveBeenCalledWith('/api/rides/ride-a/accept',expect.objectContaining({method:'POST'}));
  expect(fixture.push).toHaveBeenCalledWith('/driver/dashboard');
  expect(fixture.stopActivity).toHaveBeenCalledWith('driver_offer','ride-a');
  const closeOrder=fixture.stopActivity.mock.calls.findIndex(args=>args[1]==='ride-a');
  expect(fixture.stopActivity.mock.invocationCallOrder[closeOrder]).toBeLessThan(fixture.push.mock.invocationCallOrder[0] ?? 0);
  expect(fixture.activity.ride.id).toBe('ride-a');
 });
 it.each(['Refuser','Fermer la demande'])('keeps the underlying page when using %s',async(name)=>{
  render(<DriverActivityProvider><Probe/></DriverActivityProvider>);await flush();await receive();
  fireEvent.click(screen.getByRole('button',{name}));await flush();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(fixture.stopActivity).toHaveBeenCalledWith('driver_offer','ride-a');
  expect(screen.getByText('Page /driver/menu')).toBeTruthy();expect(fixture.push).not.toHaveBeenCalled();
 });
 it('expires after the server deadline without moving away from Reservations',async()=>{
  fixture.path='/driver/reservations';
  render(<DriverActivityProvider><Probe/></DriverActivityProvider>);await flush();await receive();
  await flush(10000);expect(screen.getByRole('button',{name:/Accepter · 35 s/})).toBeTruthy();
  await flush(35000);expect(screen.queryByRole('dialog')).toBeNull();
  expect(fixture.push).not.toHaveBeenCalled();
  expect(screen.getByText('Page /driver/reservations')).toBeTruthy();
 });
 it('uses the same card for advance reservations and opens the accepted reservation list',async()=>{
  fixture.reservations=[{id:'reservation-a',pickup_address:'Départ réservé',dropoff_address:'Arrivée réservée',scheduled_at:'2026-12-10T10:00:00Z',estimated_price:30,payment_method:'card',transport_type:'flight'}];
  render(<DriverActivityProvider><Probe/></DriverActivityProvider>);await flush();
  expect(screen.getByText('Départ réservé')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Accepter/}));await flush();
  expect(fixture.push).toHaveBeenCalledWith('/driver/reservations?accepted=reservation-a');
 });
});
