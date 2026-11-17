import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { apiFetch } from '@/lib/archive-fetch';
import ChatMedia from '@/components/ride/ChatMedia';
function EvidencePage() {
  const [archives, setArchives] = useState([]), [selected, setSelected] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const res = await apiFetch('/api/admin/chat-evidence'); const data = await res.json(); if (!res.ok) throw new Error(data.error); setArchives(data.archives); }
    catch (err) { setError(err.message || 'Chargement impossible'); }
  }, []);
  useEffect(() => { load(); const timer = setInterval(() => { setSelected(old => old && Date.parse(old.expiresAt) <= Date.now() ? null : old); load(); }, 30000); return () => clearInterval(timer); }, [load]);
  useEffect(() => {
    if (!selected) return undefined;
    const timer = setTimeout(() => setSelected(null), Math.max(0, Date.parse(selected.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [selected?.expiresAt]);
  async function inspect(id) {
    setBusy(true); setError(''); setSelected(null);
    try { const res = await apiFetch(`/api/admin/chat-evidence?id=${encodeURIComponent(id)}`); const data = await res.json(); if (!res.ok) throw new Error(data.error); setSelected(data.evidence); }
    catch (err) { setError(err.message || 'Échanges indisponibles'); }
    finally { setBusy(false); }
  }
  return <div className="content-pad" style={{ maxWidth: 900 }}>
    <h1 className="page-title">Échanges des courses signalées</h1>
    <p className="page-sub">Textes, vocaux, images et positions. Suppression 14 jours après le premier signalement. Accès réservé à l’administration.</p>
    {error && <p role="alert">{error}</p>}
    {!archives.length && <p className="mt-4">Aucun échange conservé.</p>}
    <div className="flex-col gap-3 mt-4">{archives.filter(a => Date.parse(a.expiresAt) > Date.now()).map(a => <button key={a.archiveId} type="button" className="card card-pad" style={{ textAlign: 'left', color: 'inherit' }} disabled={busy} onClick={() => inspect(a.archiveId)}><strong>Course {a.rideId}</strong><p className="small">{a.messageCount} échanges · suppression le {new Date(a.expiresAt).toLocaleString('fr-FR')}</p></button>)}</div>
    {busy && <p role="status">Chargement…</p>}
    {selected && <section className="card card-pad mt-4"><div className="flex justify-between items-center gap-2"><h2>Course {selected.rideId}</h2><button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Fermer</button></div><p className="tiny mt-2">Passager : {selected.riderId} · Chauffeur : {selected.driverId}</p><p className="tiny">Suppression : {new Date(selected.expiresAt).toLocaleString('fr-FR')}</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => inspect(selected.archiveId)}>Actualiser les fichiers</button>{selected.messages.map((m, i) => <div key={m.id || i} className="chat-evidence-message"><p className="tiny mb-2">{m.from === 'driver' ? 'Chauffeur' : 'Passager'} · {new Date(m.at).toLocaleString('fr-FR')}</p>{['audio', 'image'].includes(m.type) ? <ChatMedia key={m.url} message={m} url={m.url} /> : m.type === 'location' ? <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`}>Position partagée : {m.lat}, {m.lng}</a> : <p style={{ whiteSpace: 'pre-wrap' }}>{m.text}</p>}</div>)}</section>}
  </div>;
}
export const Route = createFileRoute('/_authenticated/admin/chat-evidence')({ component: () => <AdminLayout><EvidencePage /></AdminLayout> });
