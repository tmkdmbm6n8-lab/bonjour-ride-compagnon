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
    <section className="card card-pad mt-4" aria-label="Moyens de paiement">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2" style={{ margin: 0, fontSize: '1.1rem' }}>
          <CreditCard size={18} /> Cartes bancaires enregistrées
        </h3>
        <button type="button" className="btn btn-primary btn-sm flex items-center gap-1" onClick={handleOpenAddCard} disabled={busy || loadingSetup}>
          <Plus size={16} /> Ajouter une carte
        </button>
      </div>

      {loading ? <p className="tiny muted">Chargement de vos cartes…</p> : cards.length === 0 ? (
        <div className="text-center p-3 muted tiny">
          <p>Aucune carte enregistrée.</p>
          <p className="mt-1">Enregistrez votre carte une seule fois pour commander vos courses sans ressaisir vos numéros.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {cards.map(c => {
            const selected = selectedCardId ? selectedCardId === c.id : c.is_default;
            return <div key={c.id}
              className={`p-3 rounded-lg border flex items-center justify-between ${selected ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center gap-3">
                {onSelectCard ? <button type="button" onClick={() => onSelectCard(c)} className="flex items-center gap-3 text-left" aria-label={`Sélectionner ${c.brand} finissant par ${c.last4}`}>
                  <CreditCard size={20} />
                  <span className="text-sm font-medium uppercase">{c.brand} •••• {c.last4}{c.is_default && <span className="ml-2 tiny">(Par défaut)</span>}
                    <span className="block tiny muted">Expire {String(c.exp_month).padStart(2, '0')}/{c.exp_year}</span></span>
                </button> : <div className="flex items-center gap-3"><CreditCard size={20} /><div className="text-sm font-medium uppercase">{c.brand} •••• {c.last4}{c.is_default && <span className="ml-2 tiny">(Par défaut)</span>}<div className="tiny muted">Expire {String(c.exp_month).padStart(2, '0')}/{c.exp_year}</div></div></div>}
              </div>
              <div className="flex items-center gap-2">
                {!c.is_default && <button type="button" className="btn btn-secondary btn-sm tiny" disabled={busy}
                  onClick={() => handleSetDefault(c.id)}>Par défaut</button>}
                <button type="button" className="p-1 text-muted-foreground hover:text-destructive" disabled={busy}
                  onClick={() => handleDelete(c.id)} title="Supprimer la carte" aria-label="Supprimer la carte"><Trash2 size={16} /></button>
              </div>
            </div>;
          })}
        </div>
      )}
      <div className="mt-3 pt-3 border-t flex items-center gap-1 tiny muted">
        <ShieldCheck size={14} /> Informations bancaires sensibles traitées par Stripe
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
