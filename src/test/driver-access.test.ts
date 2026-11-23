import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { driverAccess, recordDriverAccess } from '../lib/driver-warnings.server';
function fakeAdmin() {
 const rows: any[] = [];
 return { rows, from: vi.fn(() => ({
  select() { return this; }, eq() { return this; },
  then(resolve: any) { return Promise.resolve({data:rows,error:null}).then(resolve); },
  insert(row: any) { rows.push({...row,id:String(rows.length),created_at:new Date().toISOString()}); return Promise.resolve({data:null,error:null}); },
 })) };
}
describe('signed driver suspension decisions', () => {
 beforeEach(() => { vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','unit-test-signing-key'); vi.useFakeTimers(); });
 afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
 it('does not confuse a pending application with a suspension', async () => {
  expect(await driverAccess(fakeAdmin(),'driver-a',{is_approved:false})).toEqual({suspended:false});
 });
 it('recognizes a manual suspension and its later removal without crossing accounts', async () => {
  const admin=fakeAdmin();
  await recordDriverAccess(admin,'driver-a',true);
  expect(await driverAccess(admin,'driver-a',{is_approved:false})).toEqual({suspended:true});
  expect(await driverAccess(admin,'driver-b',{is_approved:false})).toEqual({suspended:false});
  vi.advanceTimersByTime(10);
  await recordDriverAccess(admin,'driver-a',false);
  expect(await driverAccess(admin,'driver-a',{is_approved:false})).toEqual({suspended:false});
 });
 it('ignores forged or modified records and honors explicit reapproval', async () => {
  const admin=fakeAdmin();
  await recordDriverAccess(admin,'driver-a',true);
  expect(await driverAccess(admin,'driver-a',{is_approved:true})).toEqual({suspended:false});
  const envelope=JSON.parse(admin.rows[0].message);
  envelope.payload=envelope.payload.replace('driver-a','driver-b');
  admin.rows[0].message=JSON.stringify(envelope);
  expect(await driverAccess(admin,'driver-b',{is_approved:false})).toEqual({suspended:false});
 });
 it('does not report success when the suspension decision could not be saved', async () => {
  const admin={from:()=>({insert:()=>Promise.resolve({data:null,error:{message:'write failed'}})})};
  await expect(recordDriverAccess(admin,'driver-a',true)).rejects.toThrow('write failed');
 });
});
