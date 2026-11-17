import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';

const TOPICS = [
  ['general', 'Question générale'],
  ['ride_issue', 'Problème avec une course'],
  ['driver_support', 'Assistance chauffeurs'],
  ['payments', 'Paiements et portefeuille'],
  ['safety', 'Problème de sécurité'],
  ['data_request', 'Confidentialité / demande concernant les données'],
];

export default function ContactForm({ initialTopic = "general", initialMessage = "" }) {
  const [form, setForm] = useState({ name: '', email: '', topic: initialTopic, message: initialMessage, company: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (sending) return;
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de l’envoi — veuillez réessayer');
      } else {
        setSent(true);
      }
    } catch {
      setError('Échec de l’envoi — vérifiez votre connexion');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="empty" style={{ padding: 24 }}>
        <CheckCircle2 size={36} style={{ color: 'var(--success)' }} />
        <h3>Message envoyé</h3>
        <p>Merci de nous avoir contactés — nous vous répondrons à {form.email}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex-col gap-4">
      <div className="grid-2">
        <div className="field">
          <label htmlFor="c-name">Votre nom</label>
          <input id="c-name" className="input" value={form.name} onChange={set('name')} required minLength={2} maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="c-email">E-mail</label>
          <input id="c-email" className="input" type="email" value={form.email} onChange={set('email')} required maxLength={200} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="c-topic">Sujet</label>
        <select id="c-topic" className="input" value={form.topic} onChange={set('topic')}>
          {TOPICS.map(([value, label]) => ( <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="c-message">Message</label>
        <textarea
          id="c-message"
          className="input"
          rows={5}
          value={form.message}
          onChange={set('message')}
          required
          minLength={10}
          maxLength={2000}
          placeholder="Comment pouvons-nous vous aider ?"
        />
      </div>

      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        value={form.company}
        onChange={set('company')}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: -9999, height: 0, width: 0, opacity: 0 }}
      />

      {error && <p className="input-error-msg">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={sending}>
        {sending ? <span className="spinner" /> : <><Send size={16} /> Envoyer le message</>}
      </button>
    </form>
  );
}
