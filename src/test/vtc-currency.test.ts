import { describe, expect, it } from 'vitest';
import { calculateFare, DEFAULT_PRICING, DISCOUNT_RATE, formatEuro, settleDriverEarnings, pricingRules, TARIFF_VERSION, tariffRuleProblem } from '@/lib/vtc-pricing';

describe('barème distance/durée validé', () => {
  it.each([
    ['economy', 17.60], ['comfort', 22.53], ['pet', 21.60], ['xl', 31.63],
  ] as const)('calcule %s pour 10 km et 20 minutes', (type, expected) => {
    expect(calculateFare(DEFAULT_PRICING[type], 10000, 1200).total).toBe(expected);
  });
  it.each([
    ['economy', 11.98], ['comfort', 17.98], ['pet', 15.98], ['xl', 15.98],
  ] as const)('applique le minimum de %s puis le supplément et la finition au centime', (type, expected) => {
    expect(calculateFare(DEFAULT_PRICING[type], 100, 30).total).toBe(expected);
  });
  it.each([
    ['economy', 29.70], ['comfort', 38.04], ['pet', 33.70], ['xl', 50.15],
  ] as const)('retrouve le trajet Strasbourg → Molsheim en %s', (type, expected) => {
    const fare = calculateFare(DEFAULT_PRICING[type], 20513.6, 1550.1);
    expect(fare.total).toBe(expected);
    expect(fare.estimatedTotal).toBe(expected);
    expect(fare.originalTotal).toBe(expected);
    expect(fare.currency).toBe('EUR');
  });
  it('conserve les mètres et les secondes avant l’arrondi final', () => {
    expect(calculateFare(DEFAULT_PRICING.economy, 20513.6, 1550.1).total).toBe(29.70);
    expect(calculateFare(DEFAULT_PRICING.economy, 20500, 1560).total).toBe(29.74);
  });
  it('ne rajoute pas une majoration ou une ancienne remise au barème', () => {
    const fare = (calculateFare as any)(DEFAULT_PRICING.economy, 10000, 1200, 3, 0.5);
    expect(fare).toMatchObject({ total: 17.60, bookingFee: 0, surgeFare: 0, discount: 0, discountRate: 0 });
    expect(DISCOUNT_RATE).toBe(0);
  });
  it.each(['economy', 'comfort', 'pet', 'xl'] as const)('conserve la commission existante et équilibre le paiement %s', type => {
    const fare = calculateFare(DEFAULT_PRICING[type], 20513.6, 1550.1);
    expect(fare.platformCommission).toBe(10);
    expect(fare.platformFee).toBe(Math.round(fare.total * 10) / 100);
    expect(Math.round((fare.platformFee + fare.driverEarnings) * 100)).toBe(Math.round(fare.total * 100));
  });
  it('conserve le prix accepté et les gains si la course dure plus longtemps', () => {
    const fare = calculateFare(DEFAULT_PRICING.economy, 20513.6, 1550.1);
    expect(settleDriverEarnings(fare, 25000, 3600)).toEqual({ ...fare, activitySeconds: 3600 });
  });
  it.each([[-1,60],[100,-1],[NaN,60],[100,Infinity]])('refuse une distance/durée invalide : %s, %s', (meters, seconds) => {
    expect(() => calculateFare(DEFAULT_PRICING.economy, meters, seconds)).toThrow();
  });
  it('affiche les euros avec les décimales françaises', () => expect(formatEuro(29.7).replace(/\s/g,' ')).toBe('29,70 €'));
});

describe('activation des règles administrateur', () => {
  it('ignore les anciennes règles pour activer immédiatement la nouvelle grille', () => {
    const rules = pricingRules([{vehicle_type:'economy',rule:{baseFare:300,minimumFare:700,perKmRate:200,perMinRate:100}}]);
    expect(calculateFare(rules['economy'],10000,1200).total).toBe(17.60);
    expect(Object.keys(rules)).toEqual(['economy','comfort','pet','xl']);
  });
  it('accepte uniquement une grille versionnée et ne permet pas de réintroduire une commission, remise ou majoration', () => {
    const rules = pricingRules([{vehicle_type:'economy',rule:{...DEFAULT_PRICING.economy,tariffVersion:TARIFF_VERSION,perKmRate:1.2,platformCommission:90,bookingFee:50,surgeMultiplierCap:10}}]);
    expect(calculateFare(rules['economy'],10000,1200)).toMatchObject({total:19.70,platformCommission:10,bookingFee:0,surgeMultiplier:1});
  });
  it('refuse les montants vides, négatifs, infinis ou trop grands', () => {
    for(const value of [null,-1,Infinity,10001]) expect(tariffRuleProblem({...DEFAULT_PRICING.pet,supplement:value})).not.toBeNull();
  });
});
