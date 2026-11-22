import { describe, expect, it, vi } from 'vitest';
import { withdrawalQuote } from '../lib/withdrawals';
vi.mock('../lib/withdrawal-notifications.server', () => ({ notifyWithdrawalAdmins: vi.fn().mockResolvedValue({}) }));
import { requestWithdrawal, adminWithdrawalAction } from '../lib/withdrawals.server';

describe('demandes de retrait', () => {
  it('calcule les frais dynamiques (1 % + 0,50 € marge, min 1,00 €)', () => {
    expect(withdrawalQuote('10,00', 30)).toEqual({ debit: 10, amount: 9, fee: 1, stripeFee: 0.5, margin: 0.5 });
    expect(withdrawalQuote('30.00', 30)).toEqual({ debit: 30, amount: 29, fee: 1, stripeFee: 0.5, margin: 0.5 });
    expect(withdrawalQuote('100.00', 100)).toEqual({ debit: 100, amount: 98.5, fee: 1.5, stripeFee: 1, margin: 0.5 });
  });
  it.each(['9.99', '-10', 'NaN', '10.001', '', 'Infinity', '1e3'])('refuse le montant invalide %s', (value) => {
    expect(() => withdrawalQuote(value, 100)).toThrow();
  });
  it('refuse de dépasser le solde', () => { expect(() => withdrawalQuote('30.01', 30)).toThrow(); });
  it('insère une demande avec frais dynamiques', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { version: 1, requests: [] } }).mockResolvedValueOnce({ data: { id: 'request' } });
    await requestWithdrawal({ rpc }, { uid: 'driver', profile: { balance: 30 }, value: '10' });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['withdrawal_request_state', 'request_withdrawal']);
    expect(rpc.mock.calls[1]?.[1]).toEqual({ _driver: 'driver', _debit: 10, _fee: 1 });
  });
  it('ne prend pas de demande si les transactions ne sont pas activées', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { code: 'PGRST202' } });
    await expect(requestWithdrawal({ rpc }, { uid: 'd', profile: { balance: 30 }, value: '10' })).rejects.toThrow('activation');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('refuse une validation sans prestataire configuré', async () => {
    const rpc = vi.fn();
    await expect(adminWithdrawalAction({ rpc }, { uid: 'admin', body: { id: '11111111-1111-1111-1111-111111111111', action: 'approve' }, stripe: null, sendTransfer: vi.fn() })).rejects.toThrow('Stripe');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('refuse une demande sans démarrer de transfert', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {} }), sendTransfer = vi.fn();
    await adminWithdrawalAction({ rpc }, { uid: 'admin', body: { id: '11111111-1111-1111-1111-111111111111', action: 'reject' }, stripe: null, sendTransfer });
    expect(rpc.mock.calls[0]?.[0]).toBe('reject_withdrawal');
    expect(sendTransfer).not.toHaveBeenCalled();
  });
});
