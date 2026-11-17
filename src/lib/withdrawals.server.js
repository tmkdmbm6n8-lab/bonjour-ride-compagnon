import { withdrawalQuote } from './withdrawals.js';
import { EARLY_PAYOUT_FEE } from './vtc-payouts';
import { notifyWithdrawalAdmins } from './withdrawal-notifications.server';

function checked(result) {
  if (result.error) throw new Error(result.error.message || 'Impossible de traiter la demande');
  return result.data;
}
export async function withdrawalState(admin, driverId) {
  const result = await admin.rpc('withdrawal_request_state', { _driver: driverId });
  if (['PGRST202', '42883', '42P01'].includes(result.error?.code)) return { available: false, requests: [] };
  const state = checked(result);
  return { available: state?.version === 1, requests: state?.requests || [] };
}
export async function requestWithdrawal(admin, { uid, profile, value }) {
  const state = await withdrawalState(admin, uid);
  if (!state.available) throw new Error('Les demandes de retrait sont en cours d’activation. Aucun débit effectué.');
  const quote = withdrawalQuote(value, profile.balance, EARLY_PAYOUT_FEE);
  const request = checked(await admin.rpc('request_withdrawal', {
    _driver: uid, _debit: quote.debit, _fee: quote.fee,
  }));
  // The transaction also creates a durable notification event, retried by the scheduled worker.
  await notifyWithdrawalAdmins(admin, request).catch((error) => console.error('Withdrawal notification deferred:', error.message));
  return { request, ...quote };
}
export async function adminWithdrawalAction(admin, { uid, body, stripe, sendTransfer }) {
  if (!/^[0-9a-f-]{36}$/i.test(body.id || '')) throw new Error('Demande invalide');
  if (body.action === 'reject') {
    checked(await admin.rpc('reject_withdrawal', { _request: body.id, _actor: uid }));
    return { ok: true };
  }
  if (body.action !== 'approve') throw new Error('Action invalide');
  if (!stripe) throw new Error('Stripe doit être configuré avant de valider un retrait.');
  const state = await withdrawalState(admin, null);
  const request = state.requests.find((row) => row.id === body.id);
  if (!request) throw new Error('Demande introuvable');
  if (request.status === 'paid') return { ok: true };
  if (!['pending', 'processing'].includes(request.status)) throw new Error('Demande déjà traitée');
  if (request.status === 'processing' && (!Number.isFinite(Date.parse(request.reviewed_at || '')) || Date.now() - Date.parse(request.reviewed_at) >= 23 * 3600000))
    throw new Error('Ce virement doit être vérifié auprès de Stripe avant toute reprise. Aucun nouveau débit effectué.');
  const driver = checked(await admin.from('drivers').select('payout').eq('user_id', request.driver_id).single());
  const accountId = driver.payout?.stripeAccountId;
  if (!accountId) throw new Error('Le chauffeur doit configurer ses coordonnées bancaires.');
  const account = await stripe.accounts.retrieve(accountId);
  if (!account.payouts_enabled) throw new Error('Les coordonnées bancaires du chauffeur ne sont pas encore validées.');
  const approved = checked(await admin.rpc('approve_withdrawal', { _request: body.id, _actor: uid }));
  if (approved.status === 'paid') return { ok: true };
  try {
    await sendTransfer(admin, stripe, { id: approved.payout_id, amount: Number(approved.amount) }, accountId);
  } catch (error) {
    // sendTransfer reverses only definitive provider refusals; ambiguous errors stay pending for retry.
    throw error;
  }
  checked(await admin.rpc('finish_withdrawal_request', { _request: body.id }));
  return { ok: true };
}
