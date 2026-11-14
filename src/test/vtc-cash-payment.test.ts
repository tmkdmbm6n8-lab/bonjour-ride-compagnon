import {describe,it,expect} from 'vitest';
import {bookingPaymentProblem,cashDriverWalletEntry,paymentMethodOf} from '@/lib/vtc-pricing';
describe('Paiement en espèces',()=>{
 it('a cash ride can be booked with an empty wallet',()=>expect(bookingPaymentProblem('cash',0,27)).toBeNull());
 it('a wallet ride still needs enough balance',()=>expect(bookingPaymentProblem('wallet',10,27)).toMatch(/Solde insuffisant/));
 it('unknown methods fall back to the wallet',()=>expect(paymentMethodOf('carte')).toBe('wallet'));
 it('on a 27 € cash ride paying the driver 24.60 €, 2.40 € is taken from the driver wallet',()=>expect(cashDriverWalletEntry({total:27,driverEarnings:24.6})).toBe(-2.4));
});
