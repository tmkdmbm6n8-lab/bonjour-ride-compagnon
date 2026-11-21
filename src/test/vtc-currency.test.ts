import {describe,it,expect} from 'vitest';
import {calculateFare,DEFAULT_PRICING,DISCOUNT_RATE,formatEuro,settleDriverEarnings,DRIVER_MIN_NET_PER_RIDE,DRIVER_MIN_NET_PER_HOUR,DRIVER_MIN_NET_PER_KM} from '@/lib/vtc-pricing';
describe('Euro localization without changing amounts',()=>{
 it('formats 11.20 as euros with French decimals',()=>expect(formatEuro(11.20).replace(/\s/g,' ')).toBe('11,20 €'));
 it('keeps the original economy tariff before the driver floor',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720);expect(fare.originalTotal).toBe(9.1);expect(fare.currency).toBe('EUR')});
});
describe('Remise sur le tarif calculé',()=>{
 it('the default discount rate is 0 (no discount)',()=>expect(DISCOUNT_RATE).toBe(0));
 it('a 20 km ride keeps its normal price (27 €) with no discount',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,20000,1800);expect(fare.discount).toBe(0);expect(fare.total).toBe(27)});
 it('a 20 % discount never goes below the driver floor',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720,1,0.2);expect(fare.total).toBe(10.59);expect(fare.driverEarnings).toBeGreaterThanOrEqual(9)});
});
describe('Commissions et frais de réservation',()=>{
 it.each(['economy','comfort','pet','xl'] as const)('applies 15 % commission to %s',type=>{const fare=calculateFare(DEFAULT_PRICING[type],20000,1800);expect(fare.platformCommission).toBe(15);expect(fare.platformFee).toBe(Math.round(fare.total*15)/100)});
 it('keeps standard passenger booking fees at 0.50 €',()=>expect(calculateFare(DEFAULT_PRICING.economy,20000,1800).bookingFee).toBe(0.5));
});
describe('Rémunération minimale chauffeur (ARPE)',()=>{
 it('uses the agreed floors: 9 € per ride, 30 € per hour, 1 € per km',()=>{expect(DRIVER_MIN_NET_PER_RIDE).toBe(9);expect(DRIVER_MIN_NET_PER_HOUR).toBe(30);expect(DRIVER_MIN_NET_PER_KM).toBe(1)});
 it('pays at least 9 € net on a short ride, commission of 15 % included',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,500,60,1,0,0);expect(fare.total).toBe(10.59);expect(fare.platformFee).toBe(1.59);expect(fare.driverEarnings).toBe(9)});
 it('does not force the monthly hourly guarantee into each quote',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,10000,3300);expect(fare.driverMinimumNet).toBe(10);expect(fare.total).toBe(20.75);expect(fare.driverEarnings).toBe(17.64)});
 it('pays at least 1 € net per km',()=>{const fare=calculateFare({...DEFAULT_PRICING.economy,perKmRate:0.2,perMinRate:0},50000,600,1,0,0);expect(fare.driverEarnings).toBeGreaterThanOrEqual(50)});
 it('pays at least 9 € net on a short Pet ride, 15 % commission included',()=>{const fare=calculateFare(DEFAULT_PRICING.pet,500,60,1,0,0);expect(fare.platformCommission).toBe(15);expect(fare.driverEarnings).toBeGreaterThanOrEqual(9)});
 it('keeps the platform commission when a ride takes longer than planned (no top-up)',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,4800,720);const settled=settleDriverEarnings(fare,4800,3600);expect(settled.total).toBe(10.59);expect(settled.platformFee).toBe(fare.platformFee);expect(settled.driverEarnings).toBe(fare.driverEarnings);expect(settled.platformTopUp).toBeUndefined()});
 it('does not change earnings when the floor is already met',()=>{const fare=calculateFare(DEFAULT_PRICING.economy,20000,1800);const settled=settleDriverEarnings(fare,20000,2100);expect(settled.driverEarnings).toBe(22.95);expect(settled.platformTopUp).toBeUndefined()});
});
