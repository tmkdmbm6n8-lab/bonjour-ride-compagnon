import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { apiFetch } from '@/lib/archive-fetch';

function ContentReports() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  async function reload() {
    try {
      const res = await apiFetch('/api/admin/content-reports');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chargement impossible');
      setReports(data.reports || []);
      setError('');
    } catch (e) { setError(e.message || 'Chargement impossible'); }
  }
  useEffect(() => { reload(); }, []);
  async function review(id) {
    setBusy(id);
    try {
      const res = await apiFetch('/api/admin/content-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action impossible');
      await reload();
    } catch (e) { setError(e.message || 'Action impossible'); }
    finally { setBusy(null); }
  }
  return <div className="prose-page">
    <h1>Modération des messages et pièces jointes</h1>
    <p className="muted">Signalements des textes, images et vocaux. Examinez les preuves archivées et le contexte avant de clôturer un signalement. Les fichiers expirent selon la durée de conservation applicable.</p>
    {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
    <button className="btn btn-sm" type="button" onClick={reload}>Actualiser</button>
    {!reports.length && <p>Aucun signalement de contenu enregistré.</p>}
    {reports.map((r) => <div key={r.id} className="card card-pad mb-3">
      <strong>{r.messageType === 'audio' ? 'Message vocal' : r.messageType === 'image' ? 'Image' : 'Message texte'} · {r.status === 'reviewed' ? 'Traité' : 'À examiner'}</strong>
      <p className="small">Course : {r.rideId} · Message : {r.messageId}</p>
      <p className="small">Motif : {r.reason}</p>
      <p className="small muted">Signalé le {new Date(r.createdAt).toLocaleString('fr-FR')}</p>
      <a href="/admin/chat-evidence">Consulter les échanges archivés</a>
      {r.status !== 'reviewed' && <button type="button" className="btn btn-sm ml-3" disabled={busy === r.id} onClick={() => review(r.id)}>Marquer comme examiné</button>}
    </div>)}
  </div>;
}
export const Route = createFileRoute('/_authenticated/admin/content-reports')({head: () => ({ meta: [{"title": "Modération des contenus · StrasDrive"}, {"name": "description", "content": "Traitement administratif des contenus signalés dans les courses StrasDrive."}, {"property": "og:title", "content": "Modération des contenus · StrasDrive"}, {"property": "og:description", "content": "Traitement administratif des contenus signalés dans les courses StrasDrive."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }),  component: () => <AdminLayout><ContentReports /></AdminLayout> });
