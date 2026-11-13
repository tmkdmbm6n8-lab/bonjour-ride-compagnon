import {describe,it,expect} from 'vitest';
import {calculateFare,DEFAULT_PRICING,formatEuro} from '@/lib/vtc-pricing';
describe('Euro localization without changing amounts',()=>{
 it('formats 11.20 as euros with French decimals',()=>expect(formatEuro(11.20).replace(/\s/g,' ')).toBe('11,20 €'));
 it('preserves the original economy quote',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720);expect(fare.total).toBe(9.1);expect(fare.currency).toBe('EUR')});
});