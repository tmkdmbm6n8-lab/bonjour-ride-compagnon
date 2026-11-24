import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/bits';

// The QR token is stable for each driver and never refreshes on a timer.
function PrivateClientsQr({ loadQr, onQrChange }) {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    setError('');
    loadQr().then((result) => {
      if (!cancelled) {
        if (!result?.image) setError('Impossible de charger le QR code.');
        else if (result.expiresAt && result.expiresAt <= Date.now()) setError('Le QR code a expiré.');
        else setQr(result);
      }
    }).catch((err) => { if (!cancelled) setError(err?.message || 'Impossible de charger le QR code.'); });
    return () => { cancelled = true; };
  }, [loadQr, retry]);

  useEffect(() => {
    onQrChange?.(qr);
    return () => onQrChange?.(null);
  }, [qr, onQrChange]);

  return <section className="card card-pad" aria-labelledby="private-clients-qr-title">
    <h2 id="private-clients-qr-title">Votre QR code permanent</h2>
    <p className="small muted mt-2">Ce QR code personnel ne change pas et n'expire pas. Vous pouvez l'imprimer ou le partager pour inviter vos clients à vous choisir comme chauffeur favori.</p>
    {qr ? <div className="mt-4" aria-label="QR code permanent">{qr.image}</div> : error ? <div role="alert" className="mt-4"><p>{error}</p><button className="btn btn-secondary mt-2" onClick={() => setRetry((value) => value + 1)}>Réessayer</button></div> : <p className="small muted mt-4" role="status">Chargement du QR code…</p>}
  </section>;
}

export default function PrivateClientsPanel({ clients, loadQr, goldActive, onRemove, onBlock, onQrChange }) {
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  async function perform(client, action) {
    const label = action === 'remove' ? 'retirer de vos clients privés' : client.blocked ? 'débloquer' : 'bloquer';
    if (!window.confirm(`Voulez-vous ${label} ${client.name || 'ce client'} ?`)) return;
    setBusy(client.id);
    setError('');
    try {
      if (action === 'remove') await onRemove(client.id);
      else await onBlock(client.id, !client.blocked);
    } catch (e) { setError(e.message || 'Action impossible'); }
    finally { setBusy(null); }
  }
  return <div className="flex-col gap-4">
    {goldActive && <PrivateClientsQr loadQr={loadQr} onQrChange={onQrChange} />}
    <section className="card card-pad" aria-labelledby="private-clients-list-title">
      <h2 id="private-clients-list-title">Vos clients privés</h2>
      {error && <p role="alert" className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
      {clients === null ? <p className="small muted mt-3">Chargement…</p> : clients.length === 0 ? <p className="small muted mt-3">Vous n’avez pas encore de client privé.</p> : <ul className={`flex-col gap-3 mt-4${goldActive ? "" : " private-clients-list-inactive"}`}>{clients.map((client) => <li className="card card-pad" key={client.id}>
        <div className="flex items-center gap-3">
          <Avatar name={client.name || ''} src={client.avatar || ''} size="sm" />
          <strong style={{ flex: 1 }}>{client.name || 'Client StrasDrive'} {client.blocked ? '· Bloqué' : ''}</strong>
          <button type="button" className="btn btn-secondary" onClick={() => setExpanded(expanded === client.id ? null : client.id)} aria-expanded={expanded === client.id}>Infos</button>
        </div>
        {expanded === client.id && <div className="mt-3 flex-col gap-2">
          <p className="small">Client privé depuis : {client.since ? new Date(client.since).toLocaleDateString('fr-FR') : 'Date inconnue'}</p>
          <p className="small">Courses terminées ensemble : {client.completedTogether ?? 0}</p>
          <p className="small muted">Les coordonnées personnelles du passager ne sont pas divulguées depuis cette liste.</p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn btn-secondary" disabled={busy === client.id} onClick={() => perform(client, 'block')}>{client.blocked ? 'Débloquer' : 'Bloquer'}</button>
            <button type="button" className="btn btn-secondary" disabled={busy === client.id} onClick={() => perform(client, 'remove')}>Supprimer</button>
          </div>
        </div>}
      </li>)}</ul>}
    </section>
  </div>;
}
