import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/bits';

// loadQr returns { image: ReactNode, expiresAt: epoch milliseconds }.
// A caller must obtain a verified QR image from the authenticated backend.
function PrivateClientsQr({ loadQr }) {
  const [qr, setQr] = useState(null);
  const [time, setTime] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer;
    async function refresh() {
      setQr(null);
      setError('');
      try {
        const result = await loadQr();
        if (cancelled) return;
        if (!result?.image || !Number.isFinite(result.expiresAt) || result.expiresAt <= Date.now()) {
          throw new Error('Le QR code reçu a expiré.');
        }
        setQr(result);
        setTime(Date.now());
        timer = setTimeout(refresh, result.expiresAt - Date.now());
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Impossible de charger le QR code.');
      }
    }
    refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [loadQr, retry]);

  const seconds = qr ? Math.max(0, Math.ceil((qr.expiresAt - time) / 1000)) : 0;
  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return <section className="card card-pad" aria-labelledby="private-clients-qr-title">
      <h2 id="private-clients-qr-title">Votre QR code</h2>
      <p className="small muted mt-2">Invitez un nouveau client à scanner ce code pour vous choisir comme chauffeur favori.</p>
      {qr && seconds > 0 ? <><div className="mt-4" aria-label="QR code d’invitation">{qr.image}</div><p className="small muted mt-3">Renouvellement dans <strong>{countdown}</strong></p></> : error ? <div role="alert" className="mt-4"><p>{error}</p><button className="btn btn-secondary mt-2" onClick={() => setRetry((value) => value + 1)}>Réessayer</button></div> : <p className="small muted mt-4" role="status">Chargement du QR code…</p>}
  </section>;
}

export default function PrivateClientsPanel({ clients, loadQr, goldActive, onRemove, onBlock }) {
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
    {goldActive && <PrivateClientsQr loadQr={loadQr} />}
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
