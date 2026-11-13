import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from '@/lib/archive-navigation';
import { Banknote, ArrowUpRight, ShieldCheck, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { money } from '@/components/ui/bits';
import { formatRelativeTime } from '@/lib/utils/geo';

function PayoutCardInner() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

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

  async function act(action, amount) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/drivers/me/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(amount != null ? { action, amount } : { action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Une erreur est survenue', 'error', 6000);
      } else if (action === 'onboard') {
        window.location.href = data.url; // hand off to Stripe
        return;
      } else {
        toast(`${money(data.amount)} est en cours de transfert vers votre banque`, 'success', 6000);
        load();
      }
    } catch {
      toast('Erreur réseau — veuillez réessayer', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!status?.configured) return null;

  // ── Not connected yet ──
  if (!status.connected || !status.detailsSubmitted) {
    return (
      <div className="card card-pad mb-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="avatar" style={{ background: 'var(--gold-50)', color: 'var(--gold-700)' }}>
            <Banknote size={19} />
          </span>
          <div className="flex-1">
            <h3 style={{ fontSize: '1.05rem' }}>Recevez vos revenus sur votre compte bancaire</h3>
            <p className="tiny muted mt-1"> Ajoutez vos coordonnées bancaires une seule fois — Stripe les traite en toute sécurité et StrasDrive n’a jamais accès à votre numéro de compte. </p>
          </div>
        </div>
        <button className="btn btn-primary btn-full" onClick={() => act('onboard')} disabled={busy}>
          {busy ? <span className="spinner" /> : <><ShieldCheck size={17} /> Configurer les versements</>}
        </button>
      </div>
    );
  }

  // ── Submitted, still under review ──
  if (!status.payoutsEnabled) {
    return (
      <div className="card card-pad mb-4 flex items-center gap-3" style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning)' }}>
        <Clock size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
        <div className="flex-1">
          <div className="small" style={{ fontWeight: 700 }}>Stripe vérifie vos informations</div>
          <div className="tiny muted mt-1">
            This usually takes a few minutes. You keep earning meanwhile — your
            balance is {money(status.balance)}.
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => act('onboard')} disabled={busy}> Mettre à jour </button>
      </div>
    );
  }

  // ── Ready to cash out ──
  return (
    <div className="card card-pad mb-4">
      <div className="flex items-center justify-between wrap gap-3">
        <div>
          <div className="tiny muted">Montant disponible au retrait</div>
          <div className="stat-value mono-nums" style={{ fontSize: '1.9rem' }}>
            {money(status.balance)}
          </div>
          <div className="tiny muted mt-1">
            {status.lastPayoutAt
              ? `Dernier versement ${formatRelativeTime(status.lastPayoutAt)}`
              : `Versement minimum : ${money(status.minPayout)}`}
          </div>
        </div>
        <button
          className="btn btn-success"
          onClick={() => act('cashout')}
          disabled={busy || !status.canCashOut}
          title={!status.canCashOut ? `Vous devez disposer d’au moins ${money(status.minPayout)}` : undefined}
        >
          {busy ? <span className="spinner" /> : <><ArrowUpRight size={17} /> Retirer</>}
        </button>
      </div>
      <p className="tiny muted mt-3"> Versement sur votre compte bancaire par Stripe, généralement sous 1 à 2 jours ouvrés. </p>
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
