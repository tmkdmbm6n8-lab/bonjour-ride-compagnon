import ChatAttachments from "./ChatAttachments";
import ChatMedia from "./ChatMedia";
import { CHAT_NOTICE } from "@/lib/ride-chat";
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, X, MessageCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import useVisualViewport from '@/hooks/useVisualViewport';

/**
 * In-ride chat panel. Messages arrive via the socket (parent owns the
 * list); sending goes through the REST API so it's persisted.
 */
export default function ChatSheet({ rideId, role, messages, open, onClose, counterpartName }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
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
        <button className="btn btn-ghost btn-icon" style={{ minHeight: 32, width: 32 }} onClick={onClose} aria-label="Fermer la discussion">
          <X size={16} />
        </button>
      </div>

      <p className="chat-retention-notice">{CHAT_NOTICE}</p>
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
                style={{
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
