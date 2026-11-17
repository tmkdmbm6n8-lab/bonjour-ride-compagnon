import { pushUsers } from './vtc-push.server';

/** Notification event is stored by request_withdrawal, never supplied by a browser. */
export async function notifyWithdrawalAdmins(admin, request) {
  const roles = await admin.from('user_roles').select('user_id').eq('role', 'admin');
  if (roles.error) throw new Error('Administrateurs introuvables');
  const ids = [...new Set((roles.data || []).map((row) => row.user_id))];
  if (!ids.length) return { push: false, email: false };
  const message = {
    notification: { title: 'Nouvelle demande de retrait', body: 'Un chauffeur attend votre validation. Ouvrez StrasDrive.' },
    data: { type: 'withdrawal_request', requestId: String(request.id), path: '/admin/dashboard#withdrawals' },
    android: { priority: 'high', notification: { channel_id: 'ride_offers', tag: `withdrawal_${request.id}` } },
  };
  const push = await pushUsers(admin, ids, message);
  let email = false;
  // Secrets and verified sender must be configured in Lovable, never in browser code.
  if (process.env.RESEND_API_KEY && process.env.PAYOUT_NOTIFICATION_FROM) {
    const recipients = await Promise.all(ids.map(async (id) => {
      const result = await admin.auth.admin.getUserById(id);
      if (result.error) throw new Error('Adresse admin inaccessible');
      return result.data.user?.email;
    }));
    const addresses = [...new Set(recipients.filter(Boolean))];
    if (addresses.length) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `withdrawal-${request.id}` },
        body: JSON.stringify({ from: process.env.PAYOUT_NOTIFICATION_FROM, to: addresses,
          subject: 'StrasDrive — demande de retrait à valider',
          text: `Une nouvelle demande de retrait attend votre validation. Connectez-vous à votre tableau de bord administrateur StrasDrive. Référence : ${request.id}.` }),
      });
      email = response.ok;
    }
  }
  const saved = await admin.rpc('record_withdrawal_notifications', { _request: request.id, _push_ok: push, _email_ok: email });
  if (saved.error) throw new Error('Statut des notifications non enregistré');
  return { push, email };
}

export async function retryWithdrawalNotifications(admin) {
  const result = await admin.rpc('pending_withdrawal_notifications', { _limit: 25 });
  if (result.error) throw new Error('File des notifications indisponible');
  let delivered = 0;
  for (const request of result.data || []) {
    try { const outcome = await notifyWithdrawalAdmins(admin, request); if (outcome.push && outcome.email) delivered++; }
    catch (error) { console.error('Withdrawal notification retry:', error.message); }
  }
  return { attempted: (result.data || []).length, delivered };
}
