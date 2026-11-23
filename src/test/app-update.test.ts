import { describe, expect, it } from 'vitest';
import { canApplyAppUpdate } from '../lib/app-update';
import { accountRealtimeChanged } from '../lib/account-live';
const idle = () => ({ pathname: '/driver/dashboard', status: 'authenticated', live: { checkedAt: Date.now(), hasActiveRide: false }, dirty: false, idleMs: 20000, focusedTag: 'BODY' });
describe('safe automatic deployments', () => {
 it('updates only an idle, confirmed inactive session', () => expect(canApplyAppUpdate(idle())).toBe(true));
 it('never interrupts an active trip or an unconfirmed/stale ride state', () => {
  expect(canApplyAppUpdate({...idle(), live:{checkedAt:Date.now(),hasActiveRide:true}})).toBe(false);
  expect(canApplyAppUpdate({...idle(), live:null})).toBe(false);
  expect(canApplyAppUpdate({...idle(), live:{checkedAt:Date.now()-16000,hasActiveRide:false}})).toBe(false);
 });
 it('preserves input, forms, embedded payments and ongoing interaction', () => {
  expect(canApplyAppUpdate({...idle(),dirty:true})).toBe(false);
  expect(canApplyAppUpdate({...idle(),dialogOpen:true})).toBe(false);
  expect(canApplyAppUpdate({...idle(),idleMs:1000})).toBe(false);
  for(const focusedTag of ['INPUT','TEXTAREA','SELECT','IFRAME']) expect(canApplyAppUpdate({...idle(),focusedTag})).toBe(false);
  for(const pathname of ['/wallet','/driver/wallet','/login','/contact','/checkout']) expect(canApplyAppUpdate({...idle(),pathname})).toBe(false);
 });
 it('allows idle public pages without a session', () => expect(canApplyAppUpdate({...idle(),pathname:'/',status:'unauthenticated',live:null})).toBe(true));
});
describe('account realtime invalidation', () => {
 it('ignores GPS and online-time writes but reacts to permission changes', () => {
  expect(accountRealtimeChanged('drivers',{eventType:'UPDATE',old:{is_approved:true,location:{lat:0}},new:{is_approved:true,location:{lat:1}}})).toBe(false);
  expect(accountRealtimeChanged('drivers',{eventType:'UPDATE',old:{is_approved:true},new:{is_approved:false}})).toBe(true);
  expect(accountRealtimeChanged('user_roles',{eventType:'DELETE'})).toBe(true);
 });
});
