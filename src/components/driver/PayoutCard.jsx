import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from '@/lib/archive-navigation';
import { Banknote, ArrowUpRight, ShieldCheck, Clock, CalendarClock, AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { money } from '@/components/ui/bits';

const STATUS_LABEL = { pending: 'En cours', paid: 'Versé', failed: 'Refusé — recrédité' };
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/drivers/me/payouts');
      if (res.ok) setStatus(await res.json());
    } catch {
      /* leave the card hidden if this fails */
    }
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
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Une erreur est survenue', 'error', 6000);
      } else if (action === 'onboard') {
        window.location.href = data.url; // hand off to Stripe
        return;
      } else {
        toast(`${money(data.amount)} est en cours de virement vers votre banque (frais ${money(data.fee)})`, 'success', 6000);
        setConfirmOpen(false);
      }
      load();
    } catch {
      toast('Erreur réseau — veuillez réessayer', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  const bankReady = status.configured && status.connected && status.detailsSubmitted && status.payoutsEnabled;
  const owed = status.balance < 0 ? -status.balance : 0;
  const quote = status.earlyQuote || { ok: false };

  return (
    <div className="card card-pad mb-4">
      {/* Balance + next automatic transfer */}
      <div className="flex items-center justify-between wrap gap-3">
        <div>
          <div className="tiny muted">Solde de vos gains</div>
          <div className="stat-value mono-nums" style={{ fontSize: '1.9rem' }}>{money(status.balance)}</div>
        </div>
        {bankReady && (
          <button
            className="btn btn-secondary"
            onClick={() => setConfirmOpen(true)}
            disabled={busy || !quote.ok}
            title={!quote.ok ? quote.reason : undefined}
          >
            <ArrowUpRight size={17} /> Retirer maintenant
          </button>
        )}
      </div>

      <div className="flex gap-3 mt-3" style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--gold-50)', border: '1px solid var(--gold-100)' }}>
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
        <div className="flex gap-3 mt-3" style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--warning-bg)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
          <div className="tiny">
            <strong>{money(owed)} de commissions sur vos courses en espèces.</strong> Ce montant est repris automatiquement
            sur vos prochaines courses payées par portefeuille, avant tout virement.
          </div>
        </div>
      )}

      {/* Bank details */}
      {!status.configured && (
        <p className="tiny muted mt-3 flex gap-2 items-center">
          <Banknote size={15} /> Le virement vers votre banque sera activé prochainement — vos gains restent en sécurité sur votre solde d’ici là.
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

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Retirer avant lundi ?">
        <div className="flex-col gap-2 small">
          <div className="flex justify-between"><span className="muted">Solde</span><span className="mono-nums">{money(status.balance)}</span></div>
          <div className="flex justify-between"><span className="muted">Frais de retrait anticipé</span><span className="mono-nums">− {money(quote.fee ?? status.earlyFee)}</span></div>
          <div className="flex justify-between" style={{ fontWeight: 700 }}><span>Vous recevez</span><span className="mono-nums">{money(quote.amount || 0)}</span></div>
          <p className="tiny muted mt-2"> Sans frais si vous attendez le virement automatique de {formatNextPayout(status.nextPayoutAt)} à 00:00. </p>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-secondary flex-1" onClick={() => setConfirmOpen(false)}>Attendre lundi</button>
            <button className="btn btn-primary flex-1" onClick={() => act('cashout')} disabled={busy}>
              {busy ? <span className="spinner" /> : 'Retirer maintenant'}
            </button>
          </div>
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
