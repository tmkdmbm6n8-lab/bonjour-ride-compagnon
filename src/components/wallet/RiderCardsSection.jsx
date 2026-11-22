'use client';

import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Trash2, ShieldCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/archive-fetch';
import Modal from '@/components/ui/Modal';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe';

function CardSetupForm({ onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    try {
      const { setupIntent, error } = await stripe.confirmSetup({
        elements, confirmParams: { return_url: window.location.href }, redirect: 'if_required',
      });
      if (error) throw new Error(error.message || 'Impossible de valider la carte');
      if (setupIntent?.status !== 'succeeded' || typeof setupIntent.payment_method !== 'string') {
        throw new Error('Vérification bancaire non terminée');
      }
      const res = await apiFetch('/api/rider/cards/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId: setupIntent.payment_method, isDefault: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur d’enregistrement');
      toast.success('Carte bancaire enregistrée avec succès');
      onSuccess();
    } catch (error) {
      toast.error(error.message || 'Impossible d’enregistrer la carte');
    } finally {
      setSubmitting(false);
    }
  }
  return <form onSubmit={handleSubmit} className="flex flex-col gap-4">
    <PaymentElement options={{ layout: 'tabs' }} />
    <div className="flex gap-2 justify-end mt-4">
      <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>Annuler</button>
      <button type="submit" className="btn btn-primary" disabled={!stripe || !elements || submitting}>
        {submitting ? 'Vérification…' : 'Enregistrer la carte'}
      </button>
    </div>
  </form>;
}

const stripePromise = typeof window !== 'undefined' ? (() => {
  try { return getStripe(); } catch { return null; }
})() : null;

export default function RiderCardsSection({ onSelectCard, selectedCardId }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [loadingSetup, setLoadingSetup] = useState(false);

  const loadCards = useCallback(async () => {
    try {
      const res = await apiFetch('/api/rider/cards');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chargement impossible');
      setCards(data.cards || []);
    } catch (error) {
      toast.error(error.message || 'Impossible de charger vos cartes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  async function handleOpenAddCard() {
    if (loadingSetup || busy) return;
    setClientSecret(null);
    setLoadingSetup(true);
    setModalOpen(true);
    try {
      if (!stripePromise) throw new Error('Stripe n’est pas configuré');
      const res = await apiFetch('/api/rider/cards/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) throw new Error(data.error || 'Erreur d’initialisation');
      setClientSecret(data.clientSecret);
    } catch (error) {
      toast.error(error.message || 'Impossible de lancer l’enregistrement');
      setModalOpen(false);
    } finally {
      setLoadingSetup(false);
    }
  }

  function closeCardModal() {
    if (loadingSetup) return;
    setModalOpen(false);
    setClientSecret(null);
  }

  async function post(path, cardId) {
    setBusy(true);
    try {
      const res = await apiFetch(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Opération impossible');
      await loadCards();
      return true;
    } catch (error) {
      toast.error(error.message || 'Une erreur est survenue');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(cardId) {
    if (!window.confirm('Supprimer cette carte bancaire ?')) return;
    if (await post('/api/rider/cards/delete', cardId)) toast.success('Carte supprimée');
  }

  async function handleSetDefault(cardId) {
    if (await post('/api/rider/cards/default', cardId)) toast.success('Carte par défaut mise à jour');
  }

  return (
    <section className="card card-pad mt-4" aria-label="Moyens de paiement" style={{ padding: '20px', borderRadius: 22 }}>
      <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
        <span style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 13, background: 'var(--ink-100)', display: 'grid', placeItems: 'center' }}>
          <CreditCard size={21} aria-hidden="true" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 }}>Cartes bancaires</h3>
          <p className="tiny muted" style={{ margin: '3px 0 0' }}>Vos moyens de paiement</p>
        </div>
      </div>

      {loading ? (
        <p className="tiny muted" style={{ textAlign: 'center', padding: '14px 0' }}>Chargement de vos cartes…</p>
      ) : cards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '8px 12px 22px' }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 12px', borderRadius: 18, background: 'var(--ink-100)', display: 'grid', placeItems: 'center' }}>
            <CreditCard size={26} aria-hidden="true" style={{ opacity: 0.65 }} />
          </div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>Aucune carte enregistrée</p>
          <p className="small muted" style={{ margin: '6px auto 0', maxWidth: 300, lineHeight: 1.5 }}>
            Ajoutez une carte pour payer vos prochaines courses plus facilement.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2" style={{ marginBottom: 18 }}>
          {cards.map(c => {
            const selected = selectedCardId ? selectedCardId === c.id : c.is_default;
            return (
              <div key={c.id} className="flex items-center gap-3" style={{ padding: '12px', borderRadius: 14, border: '1px solid var(--border)', minWidth: 0 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--ink-100)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <CreditCard size={19} aria-hidden="true" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {onSelectCard ? (
                    <button type="button" onClick={() => onSelectCard(c)} aria-label={`Sélectionner ${c.brand} finissant par ${c.last4}`}
                      style={{ background: 'none', border: 0, color: 'inherit', padding: 0, textAlign: 'left', cursor: 'pointer', fontWeight: selected ? 700 : 600 }}>
                      {c.brand} •••• {c.last4}
                    </button>
                  ) : <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.brand} •••• {c.last4}</div>}
                  <div className="tiny muted" style={{ marginTop: 3 }}>
                    Exp. {String(c.exp_month).padStart(2, '0')}/{c.exp_year}{c.is_default ? ' · Par défaut' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  {!c.is_default && <button type="button" className="btn btn-secondary btn-sm tiny" disabled={busy} onClick={() => handleSetDefault(c.id)}>Définir</button>}
                  <button type="button" disabled={busy} onClick={() => handleDelete(c.id)} aria-label="Supprimer la carte"
                    style={{ border: 0, background: 'transparent', color: 'var(--text-3)', padding: 8, cursor: 'pointer' }}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" className="btn btn-primary" onClick={handleOpenAddCard} disabled={busy || loadingSetup}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 48, borderRadius: 13 }}>
        <Plus size={18} /> Ajouter une carte
      </button>
      <div className="flex items-center justify-center gap-2 tiny muted" style={{ marginTop: 14, textAlign: 'center', lineHeight: 1.4 }}>
        <ShieldCheck size={15} style={{ flexShrink: 0 }} aria-hidden="true" />
        <span>Enregistrement sécurisé par Stripe</span>
      </div>
      <Modal open={modalOpen} onClose={closeCardModal} title="Ajouter une carte bancaire" portal keyboardSafe>
        {loadingSetup ? <p className="tiny muted text-center p-4">Initialisation sécurisée Stripe…</p> :
          clientSecret && stripePromise ? <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
            <CardSetupForm onSuccess={() => { closeCardModal(); loadCards(); }} onCancel={closeCardModal} />
          </Elements> : null}
      </Modal>
    </section>
  );
}
