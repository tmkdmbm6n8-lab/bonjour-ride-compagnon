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

export default function PrivateClientsPanel({ clients, loadQr, goldActive }) {
  return <div className="flex-col gap-4">
    {goldActive && <PrivateClientsQr loadQr={loadQr} />}
    <section className="card card-pad" aria-labelledby="private-clients-list-title">
      <h2 id="private-clients-list-title">Vos clients privés</h2>
      {clients === null ? <p className="small muted mt-3">Chargement…</p> : clients.length === 0 ? <p className="small muted mt-3">Vous n’avez pas encore de client privé.</p> : <ul className={`flex-col gap-3 mt-4${goldActive ? "" : " private-clients-list-inactive"}`}>{clients.map((client) => <li className="flex items-center gap-3" key={client.id}><Avatar name={client.name || ''} src={client.avatar || ''} size="sm" /><span>{client.name || 'Client StrasDrive'}</span></li>)}</ul>}
    </section>
  </div>;
}
