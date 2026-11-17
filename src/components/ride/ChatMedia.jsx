import { useEffect, useState } from 'react';
import { loadChatMedia } from '@/lib/chat-media-cache';
import VoiceNote from './VoiceNote';
export default function ChatMedia({ message, rideId, url: provided }) {
  const [url, setUrl] = useState(provided || '');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (provided) { setUrl(provided); return; }
    let stopped = false, timer;
    loadChatMedia(rideId, message)
      .then(local => { if (!stopped) setUrl(local); })
      .catch(() => { if (!stopped) timer = setTimeout(() => setAttempt(a => a + 1), 3000); });
    return () => { stopped = true; clearTimeout(timer); };
  }, [rideId, message.id, provided, attempt]);
  // Réessai automatique, sans bouton.
  const retry = () => { if (!provided) { setUrl(''); setTimeout(() => setAttempt(a => a + 1), 1500); } };
  if (!url) return <span className="tiny">Chargement…</span>;
  return message.type === 'audio'
    ? <VoiceNote url={url} duration={message.duration} seed={message.id || message.at} onError={retry} />
    : <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Image partagée dans la discussion" onError={retry} style={{ display: 'block', width: '100%', maxWidth: 280, maxHeight: 240, objectFit: 'contain', borderRadius: 10 }} /></a>;
}
