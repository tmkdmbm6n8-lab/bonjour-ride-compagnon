'use client';

import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Trash2, ShieldCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/archive-fetch';

/** Le formulaire Stripe SetupIntent est fourni par le parent via onAddCard. */
export default function RiderCardsSection({ onSelectCard, selectedCardId, onAddCard }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
        {onAddCard && <button type="button" className="btn btn-secondary btn-sm" onClick={onAddCard} disabled={busy}>
          <Plus size={16} /> Ajouter
        </button>}
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
    </section>
  );
}
