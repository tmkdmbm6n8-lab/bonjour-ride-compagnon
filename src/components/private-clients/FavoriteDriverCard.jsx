import { useState } from 'react';
import { Avatar } from '@/components/ui/bits';

// This component is intentionally not mounted until the server contract is available.
export default function FavoriteDriverCard({ driver, onRemove }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!driver) return <div className="card card-pad"><h2>Aucun chauffeur favori</h2><p className="muted">Scannez le QR code d’un chauffeur ou ajoutez-le en favori après une course.</p></div>;

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onRemove();
      setConfirming(false);
    } catch (err) {
      setError(err?.message || 'Impossible de retirer ce chauffeur. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  const vehicle = [driver.vehicle?.color, driver.vehicle?.make, driver.vehicle?.model].filter(Boolean).join(' ');
  const count = Number.isInteger(driver.completedTogether) && driver.completedTogether >= 0 ? driver.completedTogether : null;
  return <section className="card card-pad" aria-label="Votre chauffeur favori">
    <div className="flex items-center gap-3">
      <Avatar name={driver.name || ''} src={driver.avatar || ''} size="lg" />
      <div><h2>{driver.name || 'Chauffeur StrasDrive'}</h2>{Number.isFinite(driver.rating) && <p className="muted">★ {driver.rating.toFixed(1).replace('.', ',')}</p>}</div>
    </div>
    {vehicle && <p className="small mt-4">Véhicule : {vehicle}</p>}
    {count !== null && <p className="small muted mt-2">{count} course{count === 1 ? '' : 's'} ensemble</p>}
    {error && <p role="alert" className="small mt-3">{error}</p>}
    {confirming ? <div className="mt-4"><p className="small">Retirer ce chauffeur de vos favoris ? Il en sera informé.</p><div className="flex gap-2 mt-2"><button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={busy}>Annuler</button><button type="button" className="btn btn-primary" onClick={remove} disabled={busy}>{busy ? 'Suppression…' : 'Confirmer'}</button></div></div> : <button type="button" className="btn btn-secondary mt-4" onClick={() => setConfirming(true)}>Retirer des favoris</button>}
  </section>;
}
