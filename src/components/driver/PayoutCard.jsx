import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from '@/lib/archive-navigation';
import { Banknote, ShieldCheck, Clock, CalendarClock, AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { withdrawalQuote } from '@/lib/withdrawals';
import { money } from '@/components/ui/bits';

const STATUS_LABEL = { pending: 'À valider', paid: 'Versé', failed: 'Refusé — recrédité' };
const KIND_LABEL = { weekly: 'Virement automatique', early: 'Retrait anticipé' };

function formatNextPayout(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
}
function formatDate(iso) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function PayoutCardInner() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sentOpen, setSentOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/drivers/me/payouts');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Chargement impossible');
      setStatus(result); setLoadError('');
    } catch { setLoadError('Impossible de charger les versements. Réessayez.'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Returning from Stripe's hosted onboarding
  useEffect(() => {
    const p = searchParams.get('payout');
    if (!p) return;
    if (p === 'done') toast('Informations de versement envoyées — vérification en cours par Stripe', 'success', 6000);
    if (p === 'refresh') toast('La configuration a été interrompue — vous pouvez la reprendre à tout moment', 'info', 5000);
    router.replace('/driver/earnings');
    load();
  }, [searchParams, router, toast, load]);

  async function act(action) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/drivers/me/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Une erreur est survenue', 'error', 6000);
      } else if (action === 'onboard') {
        window.location.href = data.url; // hand off to Stripe
        return;
      } else {
        setSentOpen(true); setAmount('');
      }
      load();
    } catch {
      toast('Erreur réseau — veuillez réessayer', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <div className="payout-card card card-pad"><p>{loadError || 'Chargement des versements…'}</p>{loadError && <button className="btn btn-secondary" onClick={load}>Réessayer</button>}</div>;

  const bankReady = status.configured && status.connected && status.detailsSubmitted && status.payoutsEnabled;
  const owed = status.balance < 0 ? -status.balance : 0;
  const pendingRequest = status.withdrawals?.requests?.find((row) => ['pending', 'processing'].includes(row.status));
  let quote = null, validation = '';
  try { quote = withdrawalQuote(amount, status.balance, status.earlyFee); } catch (error) { validation = amount ? error.message : ''; }

  return (
    <div className="card card-pad mb-4 payout-card">
      {/* Balance + next automatic transfer */}
      <div className="flex items-center justify-between wrap gap-3">
        <div>
          <div className="tiny muted">Solde de vos gains</div>
          <div className="stat-value mono-nums" style={{ fontSize: '1.9rem' }}>{money(status.balance)}</div>
        </div>

      </div>

      <div className="flex gap-3 mt-3 payout-info">
        <CalendarClock size={20} style={{ color: 'var(--gold-700)', flexShrink: 0, marginTop: 2 }} />
        <div className="small">
          <div style={{ fontWeight: 700 }}>
            Prochain virement automatique : {formatNextPayout(status.nextPayoutAt)} à 00:00
          </div>
          <div className="tiny muted mt-1">
            Chaque semaine, dans la nuit de dimanche à lundi, tout votre solde positif est viré sans frais
            {status.nextPayoutAmount > 0 ? ` — ${money(status.nextPayoutAmount)} si vous ne retirez rien d’ici là.` : '.'}
            {' '}Un retrait avant cette date coûte {money(status.earlyFee)}.
          </div>
        </div>
      </div>

      {owed > 0 && (
        <div className="flex gap-3 mt-3 payout-info payout-warning">
          <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
          <div className="tiny">
            <strong>{money(owed)} de commissions sur vos courses en espèces.</strong> Ce montant est repris automatiquement
            sur vos prochaines courses payées par carte bancaire (CB), avant tout virement.
          </div>
        </div>
      )}

      {/* Bank details */}
      {!status.configured && (
        <p className="tiny muted mt-3 flex gap-2 items-center">
          <Banknote size={15} style={{ flexShrink: 0 }} /> Le virement vers votre banque sera activé prochainement — vos gains restent en sécurité sur votre solde d’ici là.
        </p>
      )}
      {status.configured && (!status.connected || !status.detailsSubmitted) && (
        <div className="mt-3">
          <p className="tiny muted mb-2"> Ajoutez vos coordonnées bancaires une seule fois — Stripe les traite en toute sécurité et StrasDrive n’a jamais accès à votre numéro de compte. </p>
          <button className="btn btn-primary btn-full" onClick={() => act('onboard')} disabled={busy}>
            {busy ? <span className="spinner" /> : <><ShieldCheck size={17} /> Configurer les virements</>}
          </button>
        </div>
      )}
      {status.configured && status.connected && status.detailsSubmitted && !status.payoutsEnabled && (
        <div className="flex items-center gap-3 mt-3">
          <Clock size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div className="tiny muted flex-1">Stripe vérifie vos informations bancaires. Vous continuez à gagner entre-temps.</div>
          <button className="btn btn-secondary btn-sm" onClick={() => act('onboard')} disabled={busy}> Mettre à jour </button>
        </div>
      )}

      <section className="payout-request-form mt-4" aria-label="Demander un retrait">
        <h3>Demander un retrait</h3>
        <p className="tiny muted">Minimum 10 €. Votre solde reste inchangé jusqu’à la validation de l’administration.</p>
        <label htmlFor="withdrawal-amount" className="small">Montant à retirer, frais inclus (€)</label>
        <div className="flex gap-2 mt-2" style={{ alignItems: 'stretch' }}>
          <input id="withdrawal-amount" className="input" type="text" inputMode="decimal" value={amount} placeholder="10,00" disabled={busy || Boolean(pendingRequest)} onChange={(event) => setAmount(event.target.value)} style={{ minWidth: 0, flex: 1 }} />
          <button type="button" className="btn btn-secondary" disabled={busy || Boolean(pendingRequest) || status.balance < 10} onClick={() => setAmount(Number(status.balance).toFixed(2))}>Tout le solde</button>
        </div>
        {validation && <p className="tiny payout-form-message" role="status">{validation}</p>}
        {quote && <p className="tiny muted">Frais : {money(quote.fee)} · Vous recevrez {money(quote.amount)}.</p>}
        {pendingRequest && <p className="payout-info tiny">Demande de {money(pendingRequest.debit)} {pendingRequest.status === 'pending' ? 'en attente de validation' : 'validée, virement en cours'}. Aucun nouveau retrait ne peut être demandé pendant son traitement.</p>}
        {!status.withdrawals?.available && <p className="tiny muted">Les demandes de retrait sont en cours d’activation.</p>}
        {status.withdrawals?.available && !bankReady && <p className="tiny muted">Configurez et faites vérifier vos coordonnées bancaires avant d’envoyer une demande.</p>}
        <button type="button" className="btn btn-primary btn-full mt-3" disabled={busy || !quote || Boolean(pendingRequest) || !status.withdrawals?.available || !bankReady} onClick={() => act('request')}>{busy ? 'Envoi…' : 'Envoyer la demande'}</button>
      </section>

      {/* History */}
      {status.payouts?.length > 0 && (
        <div className="mt-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="tiny muted mb-2" style={{ fontWeight: 600 }}>Derniers virements</div>
          <div className="flex-col gap-2">
            {status.payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between small">
                <div>
                  <div>{KIND_LABEL[p.kind] || 'Virement'}</div>
                  <div className="tiny muted">{formatDate(p.created_at)} · {STATUS_LABEL[p.status] || p.status}{p.fee > 0 ? ` · frais ${money(p.fee)}` : ''}</div>
                </div>
                <span className="mono-nums" style={{ fontWeight: 700 }}>{money(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={sentOpen} onClose={() => setSentOpen(false)} title="Demande envoyée" portal sheetOnMobile={false}>
        <div className="payout-success-content">
          <ShieldCheck size={64} style={{ color: 'var(--gold-500)' }} />
          <h2>Votre demande a bien été envoyée</h2>
          <p>Elle sera traitée dans un délai de 5 minutes.</p>
          <p className="small muted">Votre solde sera débité uniquement après validation de l’administration.</p>
          <button className="btn btn-primary btn-full" onClick={() => setSentOpen(false)}>Compris</button>
        </div>
      </Modal>
    </div>
  );
}

export default function PayoutCard() {
  return (
    <Suspense fallback={null}>
      <PayoutCardInner />
    </Suspense>
  );
}
