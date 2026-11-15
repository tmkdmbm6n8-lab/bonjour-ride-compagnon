import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { BellRing, MessageCircle, Megaphone, Plus, Send } from 'lucide-react';
import DriverLayout from '@/components/DriverLayout';
import useDriverData from '@/hooks/useDriverData';
import { apiFetch } from '@/lib/archive-fetch';
import { useSession } from '@/lib/archive-auth';
import Modal from '@/components/ui/Modal';
import { Loading } from '@/components/ui/bits';
import useVisualViewport from '@/hooks/useVisualViewport';

function InboxPage() {
  const [filter, setFilter] = useState('all'), [page, setPage] = useState(1), [entries, setEntries] = useState([]), [selectedId, setSelectedId] = useState(null);
  const [text, setText] = useState(''), [subject, setSubject] = useState(''), [compose, setCompose] = useState(false), [sending, setSending] = useState(false), [sendError, setSendError] = useState(''), [read, setRead] = useState({});
  const { data: session } = useSession();
  const readKey = `strasdrive:inbox-read:${session?.user?.id || 'account'}`;
  const { data, error, reload } = useDriverData(`/api/drivers/me/inbox?page=${page}`, 15000);
  const viewport = useVisualViewport(Boolean(selectedId || compose));
  useEffect(() => { try { const stored = JSON.parse(localStorage.getItem(readKey) || '{}'); setRead(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}); } catch { setRead({}); } }, [readKey]);
  useEffect(() => {
    if (!data) return;
    const next = [
      ...data.threads.map((thread) => ({ id: `support:${thread.id}`, targetId: thread.id, kind: 'support', category: 'messages', subject: thread.subject, messages: thread.messages, status: thread.status, updatedAt: thread.updatedAt })),
      ...data.rides.map((ride) => ({ id: `ride:${ride.id}`, targetId: ride.id, kind: 'ride', category: 'messages', subject: `Course · ${ride.dropoff?.address || 'Discussion client'}`, messages: (ride.messages || []).map((message, index) => ({ ...message, id: message.id || `${ride.id}:${index}`, createdAt: message.at || message.createdAt })), status: ride.status, updatedAt: ride.messages?.at(-1)?.at || ride.created_at })),
    ];
    setEntries((previous) => [...new Map([...previous, ...next].map((item) => [item.id, item])).values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
  }, [data]);
  const selected = entries.find((entry) => entry.id === selectedId);
  function open(entry) {
    setSelectedId(entry.id); setText(''); setSendError('');
    const next = { ...read, [entry.id]: entry.updatedAt }; setRead(next); try { localStorage.setItem(readKey, JSON.stringify(next)); } catch {}
  }
  async function send(event) {
    event.preventDefault(); if (!text.trim() || sending) return;
    setSending(true); setSendError('');
    try {
      const path = compose || selected?.kind === 'support' ? '/api/drivers/me/inbox/support' : `/api/rides/${selected.targetId}/messages`;
      const response = await apiFetch(path, { method: 'POST', body: JSON.stringify({ text, ...(compose ? { subject } : { id: selected.targetId }) }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Envoi impossible');
      if (payload.thread) {
        const thread = payload.thread;
        const entry = { id: `support:${thread.id}`, targetId: thread.id, kind: 'support', category: 'messages', subject: thread.subject, messages: thread.messages, status: thread.status, updatedAt: thread.updatedAt };
        setEntries((old) => [entry, ...old.filter((item) => item.id !== entry.id)]); setSelectedId(entry.id);
      }
      setText(''); setCompose(false); reload();
    } catch (e) { setSendError(e.message); } finally { setSending(false); }
  }
  const visible = entries.filter((entry) => filter === 'all' || entry.category === filter);
  return <div className="driver-tab-page inbox-page">
    <div className="driver-tab-title"><div><p className="drv-eyebrow">Clients & assistance</p><h1>Inbox</h1></div><button className="driver-icon-button" onClick={() => { setCompose(true); setSelectedId(null); setText(''); setSubject(''); setSendError(''); }} aria-label="Écrire à l’administration"><Plus size={26} /></button></div>
    <div className="driver-filter-row">{[['all', 'Tout'], ['messages', 'Messages'], ['alerts', 'Alertes'], ['updates', 'Actualités']].map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`driver-chip ${filter === key ? 'selected' : ''}`}>{label}</button>)}</div>
    <h2 className="inbox-section-title">Vos conversations</h2>
    {error && <p className="driver-notice" role="alert">{error}<button className="driver-chip" onClick={reload}>Réessayer</button></p>}
    {!data && !entries.length && !error && <Loading label="Chargement des messages…" />}
    {data && !visible.length && <p className="driver-empty-state">{filter === 'alerts' ? 'Aucune alerte personnelle. Les retards de vols et de trains sont suivis dans Découvrir.' : filter === 'updates' ? 'Aucune actualité publiée pour le moment.' : 'Aucune conversation pour le moment. Vous pouvez écrire à l’administration avec le bouton +.'}</p>}
    <div className="inbox-list">{visible.map((entry) => <button key={entry.id} className="inbox-entry" onClick={() => open(entry)}><span className="inbox-entry-icon">{entry.category === 'alerts' ? <BellRing size={22} /> : entry.category === 'updates' ? <Megaphone size={22} /> : <MessageCircle size={22} />}</span><span><strong>{entry.subject}</strong><small>{entry.messages.at(-1)?.text?.slice(0, 100)}</small><small>{new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.updatedAt))}</small></span>{read[entry.id] !== entry.updatedAt && <i aria-label="Non lu" />}</button>)}</div>
    {data?.hasMore && <button className="driver-chip mt-4" onClick={() => setPage((n) => n + 1)}>Charger les conversations précédentes</button>}
    <Modal open={Boolean(selected || compose)} onClose={() => { setSelectedId(null); setCompose(false); }} title={compose ? 'Écrire à l’administration' : selected?.subject} maxWidth={640} keyboardSafe>
      <div className="inbox-conversation" style={viewport ? { maxHeight: Math.max(160, viewport.height - 160) } : undefined}>
        {compose && <input className="input" placeholder="Sujet" aria-label="Sujet" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} />}
        <div className="inbox-messages">{selected?.messages.map((message) => <div key={message.id} className={`inbox-message ${message.from === 'driver' ? 'own' : ''}`}><small>{message.from === 'admin' ? 'Administration StrasDrive' : message.from === 'driver' ? 'Vous' : 'Client'}</small><p>{message.text}</p>{message.createdAt && <small>{new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt))}</small>}</div>)}</div>
        {sendError && <p role="alert" className="driver-notice">{sendError}</p>}
        {compose || selected?.kind === 'support' || ['accepted', 'arrived', 'in_progress'].includes(selected?.status) ? <form className="inbox-compose" onSubmit={send}><textarea className="input" aria-label="Votre message" placeholder="Votre message…" required maxLength={selected?.kind === 'ride' ? 500 : 4000} value={text} onChange={(e) => setText(e.target.value)} /><button className="driver-chip" disabled={sending || !text.trim()}><Send size={18} />{sending ? 'Envoi…' : 'Envoyer'}</button></form> : <p className="driver-muted">Cette course est terminée. L’historique reste consultable.</p>}
      </div>
    </Modal>
  </div>;
}
export const Route = createFileRoute('/_authenticated/driver/inbox')({ head: () => ({ meta: [{ title: 'Inbox · StrasDrive' }] }), component: () => <DriverLayout><InboxPage /></DriverLayout> });