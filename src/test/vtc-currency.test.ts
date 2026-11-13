import {describe,it,expect} from 'vitest';
import {calculateFare,DEFAULT_PRICING,DISCOUNT_RATE,formatEuro} from '@/lib/vtc-pricing';
describe('Euro localization without changing amounts',()=>{
 it('formats 11.20 as euros with French decimals',()=>expect(formatEuro(11.20).replace(/\s/g,' ')).toBe('11,20 €'));
 it('preserves the original economy quote before discount',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720);expect(fare.originalTotal).toBe(9.1);expect(fare.currency).toBe('EUR')});
});
describe('Remise sur le tarif calculé',()=>{
 it('the default discount rate is 0 (no discount)',()=>expect(DISCOUNT_RATE).toBe(0));
 it('charges the full economy quote (9,10 €) with no discount',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720);expect(fare.discount).toBe(0);expect(fare.total).toBe(9.1)});
 it('a rate of 0.20 still applies 20 % off when re-enabled',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720,1,0.2);expect(fare.discount).toBe(1.82);expect(fare.total).toBe(7.28)});
});
