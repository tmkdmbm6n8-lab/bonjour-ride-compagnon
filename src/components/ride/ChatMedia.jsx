import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/archive-fetch';
import VoiceNote from './VoiceNote';
export default function ChatMedia({ message, rideId, url: provided }) {
  const [url, setUrl] = useState(provided || '');
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (provided) { setUrl(provided); return; }
    let stopped = false;
    apiFetch(`/api/rides/${encodeURIComponent(rideId)}/media?messageId=${encodeURIComponent(message.id)}`)
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(); if (!stopped) { setUrl(data.url); setError(false); } })
      .catch(() => { if (!stopped) setError(true); });
    return () => { stopped = true; };
  }, [rideId, message.id, provided, attempt]);
  if (error && provided) return <span className="tiny">Lien expiré ou fichier indisponible. Utilisez « Actualiser les fichiers ».</span>;
  if (error) return <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setError(false); setUrl(''); setAttempt(a => a + 1); }}>Recharger le fichier</button>;
  if (!url) return <span className="tiny">Chargement…</span>;
  return message.type === 'audio'
    ? <VoiceNote url={url} duration={message.duration} seed={message.id || message.at} onError={() => setError(true)} />
    : <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Image partagée dans la discussion" onError={() => setError(true)} style={{ display: 'block', width: '100%', maxWidth: 280, maxHeight: 240, objectFit: 'contain', borderRadius: 10 }} /></a>;
}
