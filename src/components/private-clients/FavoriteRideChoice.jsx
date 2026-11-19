import { useState } from 'react';

// The caller must provide a server-backed save operation; never modify a favorite locally only.
export default function FavoriteRideChoice({ driver, onSave }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [previousDriverId, setPreviousDriverId] = useState(null);

  if (!driver?.id) return null;

  async function save(confirmReplacement) {
    if (status === 'busy') return;
    setStatus('busy');
    setError('');
    try {
      const result = await onSave(driver.id, { confirmReplacement, expectedDriverId: confirmReplacement ? previousDriverId : null });
      if (result?.requiresConfirmation) {
        if (!result.previousDriverId) throw new Error('Impossible de confirmer le changement. Réessayez.');
        setPreviousDriverId(result.previousDriverId);
        setStatus('confirm');
      } else if (result?.ok === true) {
        setStatus('saved');
      } else {
        throw new Error(result?.error || 'Impossible de modifier votre chauffeur favori.');
      }
    } catch (err) {
      setError(err?.message || 'Impossible de modifier votre chauffeur favori.');
      setStatus('idle');
    }
  }

  if (status === 'saved') return <p className="small" role="status">Chauffeur ajouté à vos favoris.</p>;
  return <div className="flex-col gap-2">
    {status === 'confirm' && <p className="small">Vous avez déjà un chauffeur favori. Voulez-vous le remplacer par {driver.name || 'ce chauffeur'} ?</p>}
    {error && <p className="small" role="alert">{error}</p>}
    {status === 'confirm' ? <div className="flex gap-2"><button type="button" className="btn btn-secondary" onClick={() => setStatus('idle')}>Conserver mon favori</button><button type="button" className="btn btn-primary" onClick={() => save(true)}>Confirmer le changement</button></div> : <button type="button" className="btn btn-secondary" disabled={status === 'busy'} onClick={() => save(false)}>{status === 'busy' ? 'Enregistrement…' : 'Mettre ce chauffeur en favori'}</button>}
  </div>;
}
