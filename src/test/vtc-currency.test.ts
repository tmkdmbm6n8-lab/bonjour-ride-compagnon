import {describe,it,expect} from 'vitest';
import {calculateFare,DEFAULT_PRICING,DISCOUNT_RATE,formatEuro,settleDriverEarnings,DRIVER_MIN_NET_PER_RIDE,DRIVER_MIN_NET_PER_HOUR,DRIVER_MIN_NET_PER_KM} from '@/lib/vtc-pricing';
describe('Euro localization without changing amounts',()=>{
 it('formats 11.20 as euros with French decimals',()=>expect(formatEuro(11.20).replace(/\s/g,' ')).toBe('11,20 €'));
 it('keeps the original economy tariff before the driver floor',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720);expect(fare.originalTotal).toBe(9.1);expect(fare.currency).toBe('EUR')});
});
describe('Remise sur le tarif calculé',()=>{
 it('the default discount rate is 0 (no discount)',()=>expect(DISCOUNT_RATE).toBe(0));
 it('a 20 km ride keeps its normal price (27 €) with no discount',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,20000,1800);expect(fare.discount).toBe(0);expect(fare.total).toBe(27)});
 it('a 20 % discount never goes below the driver floor',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720,1,0.2);expect(fare.total).toBe(9.79);expect(fare.driverEarnings).toBeGreaterThanOrEqual(9)});
});
describe('Rémunération minimale chauffeur (ARPE)',()=>{
 it('uses the agreed floors: 9 € per ride, 30 € per hour, 1 € per km',()=>{expect(DRIVER_MIN_NET_PER_RIDE).toBe(9);expect(DRIVER_MIN_NET_PER_HOUR).toBe(30);expect(DRIVER_MIN_NET_PER_KM).toBe(1)});
 it('pays at least 9 € net on a short ride, commission of 8 % included',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,500,60,1,0,0);expect(fare.total).toBe(9.79);expect(fare.platformFee).toBe(0.78);expect(fare.driverEarnings).toBe(9.01)});
 it('pays at least 30 € net per hour, approach time included',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,10000,3300);expect(fare.driverMinimumNet).toBe(30);expect(fare.total).toBe(32.61);expect(fare.driverEarnings).toBe(30)});
 it('pays at least 1 € net per km',()=>{const fare=calculateFare({...DEFAULT_PRICING.economy,perKmRate:0.2,perMinRate:0},50000,600,1,0,0);expect(fare.driverEarnings).toBe(50)});
 it('applies the 10 % premium commission and still pays at least 9 € net',()=>{const fare=calculateFare(DEFAULT_PRICING.premium,500,60,1,0,0);expect(fare.platformFee).toBe(1.3);expect(fare.driverEarnings).toBe(11.7)});
 it('tops up the driver from the commission when the real activity time is longer; passenger price unchanged',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720);const settled=settleDriverEarnings(fare,4800,3600);expect(settled.driverEarnings).toBe(30);expect(settled.total).toBe(9.79);expect(settled.platformTopUp).toBe(20.99)});
 it('does not change earnings when the floor is already met',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,20000,1800);const settled=settleDriverEarnings(fare,20000,2100);expect(settled.driverEarnings).toBe(24.84);expect(settled.platformTopUp).toBeUndefined()});
});
