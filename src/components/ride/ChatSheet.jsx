import CloseControl from "@/components/ui/CloseControl";
import ChatAttachments from "./ChatAttachments";
import ChatMedia from "./ChatMedia";
import { CHAT_NOTICE } from "@/lib/ride-chat";
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import useVisualViewport from '@/hooks/useVisualViewport';

/**
 * In-ride chat panel. Messages arrive via the socket (parent owns the
 * list); sending goes through the REST API so it's persisted.
 */
export default function ChatSheet({ rideId, role, messages, open, onClose, counterpartName }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [moderating, setModerating] = useState(false);
  async function moderate(action, messageId) {
    if (moderating) return;
    if (action === 'block' && !window.confirm('Bloquer cet utilisateur pour les prochaines courses ? La discussion de la course actuelle reste accessible.')) return;
    if (action === 'report-message' && !window.confirm('Signaler ce message à l’assistance StrasDrive ?')) return;
    setModerating(true);
    try {
      const res = await fetch(`/api/rides/${rideId}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageId ? { messageId, reason: 'Contenu abusif ou inapproprié' } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Action impossible');
      if (action === 'block' || action === 'unblock') setBlocked(action === 'block');
      toast(action === 'report-message' ? 'Signalement transmis à l’assistance.' : action === 'block' ? 'Utilisateur bloqué pour les prochaines courses.' : 'Utilisateur débloqué.', 'success');
    } catch (err) { toast(err.message || 'Action impossible', 'error'); }
    finally { setModerating(false); }
  }
  const listRef = useRef(null);
  const toast = useToast();
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => { setIsPhone(window.matchMedia('(max-width: 640px)').matches); }, []);
  const vv = useVisualViewport(open && isPhone);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function send(e) {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/rides/${rideId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || 'Échec de l’envoi du message', 'error');
      } else {
        setText('');
      }
    } catch {
      toast('Échec de l’envoi du message', 'error');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="card animate-in"
      style={{
        position: vv ? 'fixed' : 'absolute',
        ...(vv
          ? { top: vv.top + 8, left: 8, right: 8, height: Math.min(520, vv.height - 16), zIndex: 'var(--z-sheet)' }
          : { bottom: 16, right: 16, width: 'min(380px, calc(100% - 32px))', height: 460 }),
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
        ...(vv ? null : { zIndex: 25 }),
        overflow: 'hidden',
      }}
      role="dialog"
      aria-label="Discussion"
    >
      <div
        className="flex items-center justify-between"
        style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={17} style={{ color: 'var(--gold-600)' }} />
          <span className="small" style={{ fontWeight: 700 }}>
            {counterpartName || 'Discussion'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-sm" disabled={moderating}
            onClick={() => moderate(blocked ? 'unblock' : 'block')}>
            {blocked ? 'Débloquer' : 'Bloquer'}
          </button>
          <CloseControl onClick={onClose} label="Fermer la discussion" />
        </div>
      </div>

      <p className="chat-retention-notice">{CHAT_NOTICE}</p>
      <p className="tiny muted" style={{ padding: '0 14px 8px' }}>
        Message abusif, menace ou harcèlement ?{' '}
        <a href={`/contact?topic=safety&ride=${encodeURIComponent(rideId)}`}>
          Signaler cette discussion à l’assistance
        </a>.
      </p>
      <div ref={listRef} className="flex-1" style={{ overflowY: 'auto', padding: 14 }}>
        {messages.length === 0 && (
          <p className="tiny muted text-center" style={{ paddingTop: 40 }}> Dites bonjour à votre interlocuteur. </p>
        )}
        <div className="flex-col gap-2">
          {messages.map((m, i) => {
            const mine = m.from === role;
            return (
              <div
                key={i}
                style={m.type === 'audio' ? {
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '86%',
                  color: 'var(--ink-400)',
                } : {
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  padding: '10px 14px',
                  borderRadius: 18,
                  borderBottomRightRadius: mine ? 4 : 18,
                  borderBottomLeftRadius: mine ? 18 : 4,
                  background: mine ? 'var(--gold-500)' : 'var(--ink-950)',
                  color: mine ? 'var(--ink-950)' : 'var(--text-invert)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  lineHeight: 1.35,
                  boxShadow: 'var(--shadow-sm)',
                  wordBreak: 'break-word',
                }}
              >
                {['audio', 'image'].includes(m.type) ? <ChatMedia message={m} rideId={rideId} /> : m.type === 'location' ? <a href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>📍 Position partagée · ouvrir la carte</a> : m.text}
                {!mine && m.id && <button type="button" disabled={moderating}
                  onClick={() => moderate('report-message', m.id)}
                  aria-label={`Signaler le message ${i + 1}`}
                  style={{ display: 'block', fontSize: '0.72rem', textDecoration: 'underline', marginTop: 5, color: 'inherit' }}>
                  Signaler ce {m.type === 'audio' ? 'vocal' : m.type === 'image' ? 'fichier image' : 'message'}
                </button>}
                {m.at && (
                  <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 500, opacity: 0.7, marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
                    {mine ? 'Vous · ' : ''}{new Date(m.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ChatAttachments key={rideId} rideId={rideId} />
      <form
        onSubmit={send}
        className="flex gap-2"
        style={{ padding: 12, borderTop: '1px solid var(--border)' }}
      >
        <input
          className="input flex-1"
          style={{ minWidth: 0, minHeight: 46, fontSize: '1rem' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Saisissez un message…"
          maxLength={500}
          aria-label="Message"
        />
        <button
          type="submit"
          className="btn btn-primary btn-icon"
          disabled={!text.trim() || sending}
          aria-label="Envoyer le message"
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
