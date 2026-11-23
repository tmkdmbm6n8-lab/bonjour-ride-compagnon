import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => {
 const channel:any = {on:vi.fn(),subscribe:vi.fn()};
 channel.on.mockReturnValue(channel);
 return { getUser:vi.fn(), onAuthStateChange:vi.fn(), signOut:vi.fn(), fetch:vi.fn(), channel,
  removeChannel:vi.fn(), unregister:vi.fn(), stopActivities:vi.fn() };
});
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getUser:mock.getUser,onAuthStateChange:mock.onAuthStateChange,signOut:mock.signOut},channel:()=>mock.channel,removeChannel:mock.removeChannel}}));
vi.mock('@/lib/archive-fetch',()=>({apiFetch:mock.fetch}));
vi.mock('@/lib/native-push',()=>({unregisterDriverPush:mock.unregister}));
vi.mock('@/lib/live-activity-native',()=>({stopLiveActivitiesForSignOut:mock.stopActivities}));
vi.mock('@/lib/ride-draft',()=>({clearRideDraft:vi.fn()}));
import { SessionProvider, useSession } from '../lib/archive-auth';
function Probe(){const session=useSession();return <div data-testid="session">{JSON.stringify(session)}</div>;}
let value:any;
async function flush(ms=0){await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});}
describe('live account enforcement across screens',()=>{
 beforeEach(()=>{
  vi.useFakeTimers();vi.clearAllMocks();
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  window.history.replaceState({},'', '/driver/menu');
  mock.getUser.mockResolvedValue({data:{user:{id:'driver-a'}},error:null});
  mock.onAuthStateChange.mockReturnValue({data:{subscription:{unsubscribe:vi.fn()}}});
  mock.signOut.mockResolvedValue({error:null});mock.unregister.mockResolvedValue(undefined);mock.stopActivities.mockResolvedValue(undefined);
  mock.channel.on.mockReturnValue(mock.channel);
  value={role:'driver',canDrive:true,suspended:false,hasDriverRide:false,hasActiveRide:false,revision:'initial'};
  mock.fetch.mockImplementation(async(path:string)=>({ok:true,json:async()=>path==='/api/users/me'?{user:{id:'driver-a',role:'driver',canDrive:true}}:{...value}}));
 });
 afterEach(()=>{cleanup();vi.useRealTimers();});
 it('refreshes a suspension outside the dashboard and signs out locally',async()=>{
  render(<SessionProvider><Probe/></SessionProvider>);await flush();
  value={...value,suspended:true,revision:'suspended'};
  await flush(5000);await vi.dynamicImportSettled();await flush();
  expect(mock.signOut).toHaveBeenCalledWith({scope:'local'});
  expect(mock.unregister).toHaveBeenCalled();
 });
 it('lets the existing trip finish before disconnecting',async()=>{
  value={...value,suspended:true,hasDriverRide:true,hasActiveRide:true};
  render(<SessionProvider><Probe/></SessionProvider>);await flush(10000);
  expect(mock.signOut).not.toHaveBeenCalled();
  value={...value,hasDriverRide:false,hasActiveRide:false};
  await flush(5000);await vi.dynamicImportSettled();await flush();
  expect(mock.signOut).toHaveBeenCalledWith({scope:'local'});
 });
 it('does not revoke passenger access because the driver activity is suspended',async()=>{
  window.history.replaceState({},'', '/dashboard');
  value={...value,suspended:true};
  render(<SessionProvider><Probe/></SessionProvider>);await flush(10000);
  expect(mock.signOut).not.toHaveBeenCalled();
  expect(screen.getByTestId('session').textContent).toContain('"suspended":true');
 });
 it('keeps the last confirmed session on a temporary network failure',async()=>{
  render(<SessionProvider><Probe/></SessionProvider>);await flush();
  mock.fetch.mockRejectedValue(new Error('offline'));
  await flush(10000);
  expect(mock.signOut).not.toHaveBeenCalled();
  expect(screen.getByTestId('session').textContent).toContain('"status":"authenticated"');
 });
});
