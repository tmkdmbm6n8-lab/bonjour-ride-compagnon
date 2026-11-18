import { accountView } from '@/lib/account-mode';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from '@/lib/archive-navigation';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, Receipt, CreditCard } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Loading, Empty, money } from '@/components/ui/bits';
import { formatRelativeTime } from '@/lib/utils/geo';
import EmbeddedPayment from '@/components/payments/EmbeddedPayment';
import { getStripeEnvironment } from '@/lib/stripe';
import { TOPUP_MIN, TOPUP_MAX, topupAmountProblem } from '@/lib/vtc-checkout';

const TXN_LABEL = {
  topup: 'Recharge du portefeuille',
  ride_payment: 'Paiement de course',
  ride_earning: 'Revenus de course',
  refund: 'Remboursement',
  cancellation_fee: 'Frais d’annulation',
  payout: 'Virement vers votre banque',
  payout_fee: 'Frais de retrait anticipé',
  payout_reversal: 'Virement refusé — recrédité',
  cash_commission: 'Commission (course payée en espèces)',
};

export default function WalletPanel({ headingAction = null }) {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [amount, setAmount] = useState('25');
  const [checkoutKey, setCheckoutKey] = useState(0); // >0 while Stripe's card form is shown
  const sessionRef = useRef(null);
  const verifiedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet');
      if (res.ok) {
        const data = await res.json();
        setWallet(data.wallet);
        setTransactions(data.transactions);
        setStripeEnabled(Boolean(data.stripeEnabled));
      }
    } catch {
      setTransactions([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Returning from Stripe Checkout — verify & credit (idempotent with webhook)
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const cancelled = searchParams.get('topup') === 'cancelled';
    if (verifiedRef.current) return;

    if (cancelled) {
      verifiedRef.current = true;
      toast('Recharge annulée — aucun montant n’a été débité', 'info');
      router.replace(window.location.pathname);
      return;
    }
    if (!sessionId) return;
    verifiedRef.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/wallet/checkout?session_id=${encodeURIComponent(sessionId)}&env=${getStripeEnvironment()}`);
        const data = await res.json();
        if (res.ok && data.error) {
          toast(data.error, 'error', 6000);
        } else if (res.ok && data.paid) {
          toast(
            data.credited
              ? `${money(data.amount)} ajoutés à votre portefeuille`
              : 'Paiement reçu — solde mis à jour',
            'success',
            5000
          );
        } else if (res.ok && !data.paid) {
          toast('Paiement non effectué — aucun montant n’a été débité', 'info', 5000);
        } else {
          toast(data.error || 'Impossible de vérifier le paiement', 'error', 6000);
        }
      } catch {
        toast('Impossible de vérifier le paiement — actualisez dans un instant', 'error', 6000);
      } finally {
        router.replace(window.location.pathname);
        load();
      }
    })();
  }, [searchParams, router, toast, load]);

  function startTopup() {
    const problem = topupAmountProblem(amount);
    if (problem) {
      toast(problem, 'error');
      return;
    }
    sessionRef.current = null;
    setCheckoutKey((k) => k + 1);
  }

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch('/api/wallet/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount), environment: getStripeEnvironment(), origin: window.location.origin, view: accountView(window.location.pathname) }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      toast(data.error || 'Impossible de lancer le paiement', 'error', 6000);
      throw new Error(data.error || 'Impossible de lancer le paiement');
    }
    sessionRef.current = data.sessionId;
    return data.clientSecret;
  }, [amount, toast]);

  const onPaid = useCallback(async () => {
    const sessionId = sessionRef.current;
    setCheckoutKey(0);
    setTopupOpen(false);
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/wallet/checkout?session_id=${encodeURIComponent(sessionId)}&env=${getStripeEnvironment()}`);
      const data = await res.json();
      if (res.ok && data.paid) toast(`${money(data.amount)} ajoutés à votre portefeuille`, 'success', 5000);
      else toast(data.error || 'Paiement en cours de vérification — votre solde sera mis à jour', 'info', 6000);
    } catch {
      toast('Paiement reçu — actualisez dans un instant pour voir votre solde', 'info', 6000);
    } finally {
      load();
    }
  }, [toast, load]);

  function closeTopup() {
    setCheckoutKey(0);
    setTopupOpen(false);
  }

  const owes = wallet ? wallet.balance < 0 : false;

  return (
    <div className="content-pad" style={{ maxWidth: 720 }}>
      {headingAction ? <div className="driver-account-heading"><h1 className="page-title">Portefeuille</h1>{headingAction}</div> : <h1 className="page-title">Portefeuille</h1>}
      <p className="page-sub mb-6">Payez vos courses instantanément, sans chercher votre carte</p>

      <div
        className="card card-pad"
        style={{ background: 'var(--ink-950)', color: 'var(--text-invert)', border: 'none' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="tiny" style={{ opacity: 0.7 }}>
              {owes ? 'Solde débiteur' : 'Solde disponible'}
            </div>
            <div
              style={{
                fontSize: '2.2rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: owes ? '#fca5a5' : undefined,
              }}
              className="mono-nums"
            >
              {wallet ? money(Math.abs(wallet.balance)) : '—'}
            </div>
          </div>
          <Wallet size={36} style={{ opacity: 0.35 }} />
        </div>

        {owes && (
          <p className="small mt-3" style={{ color: '#fca5a5' }}>
            Vous devez {money(Math.abs(wallet.balance))} — rechargez votre portefeuille pour réserver à nouveau.
          </p>
        )}
        <button className="btn btn-gold mt-4" onClick={() => setTopupOpen(true)}>
          <Plus size={17} /> Ajouter des fonds </button>
      </div>

      <h2 className="small mt-8 mb-3" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}> Activité </h2>

      {transactions === null && <Loading label="Chargement de l’activité…" />}
      {transactions?.length === 0 && (
        <Empty icon={Receipt} title="Aucune activité pour le moment" hint="Vos recharges et paiements de courses apparaîtront ici." />
      )}

      <div className="card">
        {transactions?.map((t, i) => {
          const credit = t.amount > 0;
          return (
            <div
              key={t._id}
              className="flex items-center gap-3"
              style={{
                padding: '14px 18px',
                borderBottom: i < transactions.length - 1 ? '1px solid var(--ink-100)' : 'none',
              }}
            >
              <span
                className="avatar avatar-sm"
                style={{ background: credit ? 'var(--success-bg)' : 'var(--danger-bg)', color: credit ? 'var(--success)' : 'var(--danger)' }}
              >
                {credit ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
              </span>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="small truncate" style={{ fontWeight: 600 }}>
                  {TXN_LABEL[t.type] || t.type}
                </div>
                <div className="tiny muted truncate">{t.note || formatRelativeTime(t.createdAt)}</div>
              </div>
              <div className="text-right">
                <div className="small mono-nums" style={{ fontWeight: 700, color: credit ? 'var(--success)' : 'var(--text)' }}>
                  {credit ? '+' : ''}{money(t.amount)}
                </div>
                <div className="tiny muted mono-nums">{money(t.balanceAfter)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={topupOpen} onClose={closeTopup} title="Ajouter des fonds" maxWidth={checkoutKey ? 520 : 440}>
        {checkoutKey ? (
          <EmbeddedPayment key={checkoutKey} fetchClientSecret={fetchClientSecret} onComplete={onPaid} />
        ) : (
          <div className="flex-col gap-4">
            <div className="field">
              <label htmlFor="custom-amount">Montant à ajouter (€)</label>
              <input
                id="custom-amount"
                className="input"
                type="number"
                inputMode="decimal"
                min={TOPUP_MIN}
                max={TOPUP_MAX}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <p className="tiny muted">
              {stripeEnabled
                ? `Entre ${money(TOPUP_MIN)} et ${money(TOPUP_MAX)}. Le paiement se fait par carte sur le formulaire sécurisé Stripe ; les fonds sont disponibles dès le paiement validé.`
                : 'Le paiement par carte n’est pas encore activé.'}
            </p>
            <button className="btn btn-primary btn-full" onClick={startTopup} disabled={!stripeEnabled}>
              <CreditCard size={17} /> Payer {money(parseFloat(amount) || 0)} par carte
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
