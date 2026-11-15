import { useState } from 'react';
import { apiFetch } from '@/lib/archive-fetch';
import { parseSupportThread } from '@/lib/vtc-support';
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
  return <div className="admin-support-conversation"><h3 className="small mb-3">{thread.subject}</h3>{thread.messages.map((message) => <div key={message.id} className="admin-support-message"><strong>{message.from === 'admin' ? 'Administration' : row.name}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{message.text}</p><small>{new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(new Date(message.createdAt))}</small></div>)}<form onSubmit={send} className="flex-col gap-2 mt-3"><textarea className="input" aria-label={`Répondre à ${row.name}`} placeholder="Votre réponse…" maxLength={4000} required value={text} onChange={(e) => setText(e.target.value)} />{error && <p role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? 'Envoi…' : 'Envoyer la réponse'}</button></form></div>;
}