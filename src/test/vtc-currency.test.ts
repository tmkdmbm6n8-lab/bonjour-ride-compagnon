import {describe,it,expect} from 'vitest';
import {calculateFare,DEFAULT_PRICING,DISCOUNT_RATE,formatEuro,settleDriverEarnings} from '@/lib/vtc-pricing';
describe('Euro localization without changing amounts',()=>{
 it('formats 11.20 as euros with French decimals',()=>expect(formatEuro(11.20).replace(/\s/g,' ')).toBe('11,20 €'));
 it('keeps the original economy tariff before the driver floor',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720);expect(fare.originalTotal).toBe(9.1);expect(fare.currency).toBe('EUR')});
});
describe('Remise sur le tarif calculé',()=>{
 it('the default discount rate is 0 (no discount)',()=>expect(DISCOUNT_RATE).toBe(0));
 it('a long ride keeps its normal price with no discount',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,20000,1800);expect(fare.discount).toBe(0);expect(fare.total).toBe(31)});
 it('a 20 % discount never goes below the driver floor',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720,1,0.2);expect(fare.driverEarnings).toBeGreaterThanOrEqual(9);expect(fare.total).toBe(10.98)});
});
describe('Rémunération minimale chauffeur (ARPE)',()=>{
 it('pays at least 9 € net on a very short ride',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,500,60,1,0,0);expect(fare.driverEarnings).toBe(9);expect(fare.total).toBe(9.79)});
 it('pays at least 30 € net per hour including the 5 min approach',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720);expect(fare.driverMinimumNet).toBe(8.5>9?8.5:9);const long=calculateFare(DEFAULT_PRICING.economy,10000,3300);expect(long.driverEarnings).toBeGreaterThanOrEqual(30)});
 it('pays at least 1 € net per km',()=>{const fare=calculateFare({...DEFAULT_PRICING.economy,perKmRate:0.2,perMinRate:0},50000,600,1,0,0);expect(fare.driverEarnings).toBeGreaterThanOrEqual(50)});
 it('covers the 10 % premium commission',()=>{const fare=calculateFare(DEFAULT_PRICING.premium,500,60,1,0,0);expect(fare.platformCommission).toBe(10);expect(fare.driverEarnings).toBeGreaterThanOrEqual(9);expect(fare.total).toBe(12.4)});
 it('tops up the driver from the commission when the real activity time is longer',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720);const settled=settleDriverEarnings(fare,4800,3600);expect(settled.driverEarnings).toBe(30);expect(settled.total).toBe(fare.total);expect(settled.platformTopUp).toBeGreaterThan(0)});
});
