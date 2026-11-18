import { useState } from 'react';
import { apiFetch } from '@/lib/archive-fetch';
import { parseSupportThread } from '@/lib/vtc-support';
import { Sparkles } from 'lucide-react';
const URGENCY_TONE = { critique: 'badge-danger', haute: 'badge-warning', normale: 'badge-info', basse: 'badge-neutral' };
const CATEGORY_LABEL = { general: 'Général', ride_issue: 'Problème de course', driver_support: 'Assistance chauffeurs', payments: 'Paiements', safety: 'Sécurité', data_request: 'Données personnelles' };
function AssistPanel({ row, onUse }) {
  const [assist, setAssist] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function analyse() {
    if (busy) return; setBusy(true); setError('');
    try {
      const response = await apiFetch('/api/admin/support/assist', { method: 'POST', body: JSON.stringify({ id: row.id || row._id }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Analyse impossible');
      setAssist(payload.assist);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="admin-support-assist">
    <button type="button" className="btn btn-secondary btn-sm" onClick={analyse} disabled={busy}><Sparkles size={14} /> {busy ? 'Analyse en cours…' : assist ? 'Relancer l’analyse IA' : 'Analyser avec l’IA'}</button>
    {error && <p role="alert" className="small mt-2">{error}</p>}
    {assist && <div className="admin-support-assist-card">
      <div className="flex gap-2 wrap items-center"><span className={`badge ${URGENCY_TONE[assist.urgency] || 'badge-neutral'}`}>Urgence {assist.urgency}</span><span className="badge badge-neutral">{CATEGORY_LABEL[assist.category] || assist.category}</span><span className="tiny muted">Suggestion IA, à relire avant envoi</span></div>
      <p className="small">{assist.summary}</p>
      {assist.toCheck.length > 0 && <><strong className="tiny">À vérifier avant de répondre</strong><ul className="small">{assist.toCheck.map((item) => <li key={item}>{item}</li>)}</ul></>}
      <strong className="tiny">Brouillon de réponse</strong>
      <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{assist.suggestedReply}</p>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onUse(assist.suggestedReply)}>Utiliser ce brouillon</button>
    </div>}
  </div>;
}
export default function SupportConversation({ row, onSent }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const thread = parseSupportThread(row);
  async function send(event) {
    event.preventDefault(); if (busy || !text.trim()) return; setBusy(true); setError('');
    try {
      const response = await apiFetch('/api/admin/support/reply', { method: 'POST', body: JSON.stringify({ id: row.id || row._id, text }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Envoi impossible');
      setText(''); onSent?.();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="admin-support-conversation"><h3 className="small mb-3">{thread.subject}</h3>{thread.messages.map((message) => <div key={message.id} className="admin-support-message"><strong>{message.from === 'admin' ? 'Administration' : row.name}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{message.text}</p><small>{new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(new Date(message.createdAt))}</small></div>)}<AssistPanel row={row} onUse={(draft) => setText(draft)} /><form onSubmit={send} className="flex-col gap-2 mt-3"><textarea className="input" aria-label={`Répondre à ${row.name}`} placeholder="Votre réponse…" maxLength={4000} required value={text} onChange={(e) => setText(e.target.value)} />{error && <p role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? 'Envoi…' : 'Envoyer la réponse'}</button></form></div>;
}