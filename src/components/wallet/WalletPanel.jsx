import { accountView } from '@/lib/account-mode';
import { apiFetch as fetch } from '@/lib/archive-fetch';
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet, ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Loading, Empty, money } from '@/components/ui/bits';
import { formatRelativeTime } from '@/lib/utils/geo';
import RiderCardsSection from './RiderCardsSection';

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
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet');
      if (res.ok) {
        const data = await res.json();
        setWallet(data.wallet);
        setTransactions(data.transactions);
      }
    } catch {
      setTransactions([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const owes = wallet ? wallet.balance < 0 : false;

  return (
    <div className="content-pad" style={{ maxWidth: 720 }}>
      {headingAction ? (
        <div className="driver-account-heading">
          <h1 className="page-title">Portefeuille</h1>
          {headingAction}
        </div>
      ) : (
        <h1 className="page-title">Portefeuille</h1>
      )}
      <p className="page-sub mb-6">Payez vos courses instantanément avec votre carte bancaire</p>

      {/* Carte solde informatif */}
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
            Vous devez {money(Math.abs(wallet.balance))} suite à une annulation tardive.
          </p>
        )}
      </div>

      {/* Cartes bancaires enregistrées : ajout en 1 clic sans prélèvement */}
      <RiderCardsSection />

      <h2
        className="small mt-8 mb-3"
        style={{
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-3)',
        }}
      >
        Activité
      </h2>

      {transactions === null && <Loading label="Chargement de l’activité…" />}
      {transactions?.length === 0 && (
        <Empty
          icon={Receipt}
          title="Aucune activité pour le moment"
          hint="Vos paiements de courses apparaîtront ici."
        />
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
                style={{
                  background: credit ? 'var(--success-bg)' : 'var(--danger-bg)',
                  color: credit ? 'var(--success)' : 'var(--danger)',
                }}
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
                <div
                  className="small mono-nums"
                  style={{ fontWeight: 700, color: credit ? 'var(--success)' : 'var(--text)' }}
                >
                  {credit ? '+' : ''}
                  {money(t.amount)}
                </div>
                <div className="tiny muted mono-nums">{money(t.balanceAfter)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
