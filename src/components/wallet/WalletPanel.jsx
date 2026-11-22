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

      <div className="card" style={{ overflow: 'hidden' }}>
        {transactions?.map((t, i) => {
          const credit = t.amount > 0;
          const commission = t.type === 'cash_commission';
          const date = t.ride?.date || t.createdAt;
          const dateLabel = date && !Number.isNaN(new Date(date).getTime())
            ? new Intl.DateTimeFormat('fr-FR', {
                timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit',
                year: 'numeric', hour: '2-digit', minute: '2-digit',
              }).format(new Date(date))
            : 'Date indisponible';
          const fare = Number(t.ride?.total);
          const hasFare = t.ride?.total != null && Number.isFinite(fare) && fare >= 0;
          return (
            <div key={t._id} style={{
              padding: '17px 18px', borderBottom: i < transactions.length - 1
                ? '1px solid rgba(148,163,184,0.22)' : 'none',
            }}>
              <div className="flex items-center justify-between gap-3" style={{ minWidth: 0 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: 'var(--text-invert)', fontWeight: 700, fontSize: '0.98rem', lineHeight: 1.35 }}>
                    {commission ? 'Course en espèces' : TXN_LABEL[t.type] || t.type}
                  </div>
                  <div style={{ color: '#AAB5C5', fontSize: '0.8rem', marginTop: 5 }}>{dateLabel}</div>
                </div>
                <span style={{
                  flexShrink: 0, fontWeight: 750, fontSize: '1rem',
                  fontVariantNumeric: 'tabular-nums',
                  color: credit ? '#86EFAC' : '#FDA4AF',
                }}>
                  {credit ? '+' : '−'}{money(Math.abs(t.amount))}
                </span>
              </div>
              {commission ? (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 12px',
                  marginTop: 14, padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(148,163,184,0.09)', fontSize: '0.85rem',
                }}>
                  <span style={{ color: '#AAB5C5' }}>Prix de la course</span>
                  <strong style={{ color: '#F3F4F6', fontVariantNumeric: 'tabular-nums' }}>
                    {hasFare ? money(fare) : 'Non disponible'}
                  </strong>
                  <span style={{ color: '#AAB5C5' }}>Commission</span>
                  <strong style={{ color: '#FDA4AF', fontVariantNumeric: 'tabular-nums' }}>
                    {money(Math.abs(t.amount))}
                  </strong>
                </div>
              ) : t.ride && hasFare ? (
                <div style={{ marginTop: 9, fontSize: '0.82rem', color: '#AAB5C5' }}>
                  Prix de la course : <span style={{ color: '#F3F4F6' }}>{money(fare)}</span>
                </div>
              ) : null}
              <div style={{ marginTop: 10, color: '#AAB5C5', fontSize: '0.78rem' }}>
                Solde après opération : {money(t.balanceAfter)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
