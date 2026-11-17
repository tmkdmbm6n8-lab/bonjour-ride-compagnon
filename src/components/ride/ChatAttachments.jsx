import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Plus, Image, MapPin, Send, X } from 'lucide-react';
import { apiFetch } from '@/lib/archive-fetch';
import { useToast } from '@/components/ui/Toast';
const toBase64 = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
export default function ChatAttachments({ rideId }) {
  const [menu, setMenu] = useState(false), [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0), [busy, setBusy] = useState(false), [draft, setDraft] = useState(null);
  const input = useRef(null), recorder = useRef(null), stream = useRef(null), timer = useRef(null), mounted = useRef(true), pending = useRef(false), preview = useRef('');
  const toast = useToast();
  function stopTracks() { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; clearInterval(timer.current); }
  function clearDraft() { if (preview.current) URL.revokeObjectURL(preview.current); preview.current = ''; setDraft(null); }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); stopTracks(); if (preview.current) URL.revokeObjectURL(preview.current); }; }, []);
  async function request(path, body) {
    const res = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Envoi impossible');
  }
  async function upload(file, duration) {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { await request(`/api/rides/${rideId}/attachment`, { mime: file.type, data: await toBase64(file), ...(duration ? { duration } : {}) }); clearDraft(); setMenu(false); }
    catch (err) { toast(err.message || 'Échec de l’envoi', 'error'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  async function startRecording() {
    if (pending.current || recorder.current?.state === 'recording') return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { toast('Les vocaux ne sont pas disponibles dans ce navigateur.', 'error'); return; }
    pending.current = true;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('Format audio non pris en charge');
      const rec = new MediaRecorder(media, { mimeType, audioBitsPerSecond: 32000 });
      recorder.current = rec;
      const chunks = [], started = Date.now();
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stopTracks();
        if (!mounted.current) return;
        setRecording(false);
        const file = new Blob(chunks, { type: rec.mimeType });
        if (!file.size || file.size > 1024 * 1024) { toast('Enregistrement vide ou trop volumineux.', 'error'); return; }
        preview.current = URL.createObjectURL(file);
        setDraft({ file, duration: Math.min(60, Math.max(1, Math.round((Date.now() - started) / 1000))), url: preview.current });
      };
      rec.onerror = () => { stopTracks(); if (mounted.current) { setRecording(false); toast('Enregistrement interrompu.', 'error'); } };
      rec.start(); setRecording(true); setSeconds(0); setMenu(false);
      timer.current = setInterval(() => { const n = Math.floor((Date.now() - started) / 1000); setSeconds(Math.min(60, n)); if (n >= 60 && rec.state === 'recording') rec.stop(); }, 250);
    } catch (err) { stopTracks(); toast(err.name === 'NotAllowedError' ? 'Autorisez le microphone pour enregistrer un vocal.' : err.message || 'Microphone indisponible', 'error'); }
    finally { pending.current = false; }
  }
  async function shareLocation() {
    if (pending.current) return;
    if (!navigator.geolocation) { toast('Position indisponible dans ce navigateur.', 'error'); return; }
    pending.current = true; setBusy(true);
    try {
      const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }));
      if (!mounted.current) return;
      await request(`/api/rides/${rideId}/messages`, { type: 'location', lat: pos.coords.latitude, lng: pos.coords.longitude }); setMenu(false);
    } catch { toast('La position n’a pas pu être partagée. Vérifiez l’autorisation de localisation.', 'error'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className="chat-attachments">
    {draft ? <div className="chat-voice-preview"><audio controls src={draft.url} aria-label="Écouter le vocal avant envoi" /><button type="button" className="btn btn-ghost btn-icon" aria-label="Supprimer le vocal" disabled={busy} onClick={clearDraft}><X size={18} /></button><button type="button" className="btn btn-primary btn-icon" aria-label="Envoyer le vocal" disabled={busy} onClick={() => upload(draft.file, draft.duration)}><Send size={18} /></button></div> : <>
      <button type="button" className="btn btn-ghost btn-icon" aria-label={menu ? 'Fermer les pièces jointes' : 'Ajouter une pièce jointe'} aria-expanded={menu} disabled={busy || recording} onClick={() => setMenu(!menu)}><Plus size={20} /></button>
      <button type="button" className="btn btn-ghost btn-icon" aria-label={recording ? 'Arrêter l’enregistrement' : 'Enregistrer un vocal'} disabled={busy} onClick={recording ? () => recorder.current?.stop() : startRecording}>{recording ? <><Square size={16} /><span>{seconds}s</span></> : <Mic size={20} />}</button>
      {recording && <span role="status" className="tiny">Enregistrement · 60 s maximum</span>}
      {busy && <span role="status" className="tiny">Envoi…</span>}
      {menu && <div className="chat-attachment-menu"><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => input.current?.click()}><Image size={18} /> Envoyer une image</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={shareLocation}><MapPin size={18} /> Partager ma position</button></div>}
    </>}
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (file.size > 4 * 1024 * 1024) { toast('Image trop volumineuse : 4 Mo maximum.', 'error'); return; } upload(file); }} />
  </div>;
}
