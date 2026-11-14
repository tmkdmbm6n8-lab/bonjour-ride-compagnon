import {describe,it,expect} from 'vitest';
import {EARLY_PAYOUT_FEE,earlyPayoutQuote,isPayoutWindow,nextPayoutAt,payoutWeekKey,weeklyPayoutAmount} from '@/lib/vtc-payouts';
describe('Virements chauffeurs hebdomadaires',()=>{
 it('early withdrawal costs 0.50 €',()=>expect(EARLY_PAYOUT_FEE).toBe(0.5));
 it('withdrawing 40 € early pays 39.50 €',()=>expect(earlyPayoutQuote(40)).toEqual({ok:true,amount:39.5,fee:0.5}));
 it('early withdrawal is refused below 5.50 € of balance',()=>expect(earlyPayoutQuote(5.49).ok).toBe(false));
 it('the weekly transfer pays the whole balance without fee',()=>expect(weeklyPayoutAmount(87.35)).toBe(87.35));
 it('a negative balance (cash commissions owed) is not paid',()=>expect(weeklyPayoutAmount(-3.2)).toBe(0));
 it('next transfer after Saturday 14 Nov 2026 is Monday 16 Nov 00:00 Paris (23:00 UTC Sunday, winter)',()=>
  expect(nextPayoutAt(new Date('2026-11-14T10:00:00Z')).toISOString()).toBe('2026-11-15T23:00:00.000Z'));
 it('in summer Monday 00:00 Paris is 22:00 UTC Sunday',()=>
  expect(nextPayoutAt(new Date('2026-07-01T10:00:00Z')).toISOString()).toBe('2026-07-05T22:00:00.000Z'));
 it('Sunday 23:30 Paris is not yet the payout window',()=>expect(isPayoutWindow(new Date('2026-11-15T22:30:00Z'))).toBe(false));
 it('Monday 00:00 Paris is the payout window',()=>expect(isPayoutWindow(new Date('2026-11-15T23:00:20Z'))).toBe(true));
 it('the weekly run is keyed by the Paris Monday date',()=>expect(payoutWeekKey(new Date('2026-11-15T23:00:20Z'))).toBe('2026-11-16'));
});
