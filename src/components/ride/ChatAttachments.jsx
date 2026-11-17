import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AudioLines, Plus, Image, MapPin, Send, X, Trash2, ChevronsLeft } from 'lucide-react';
import { apiFetch } from '@/lib/archive-fetch';
import { useToast } from '@/components/ui/Toast';
const toBase64 = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
// Micro gardé ouvert quelques secondes après un vocal : le vocal suivant démarre sans attendre le téléphone.
const MIC_IDLE_MS = 20000;
const MIC_CONSTRAINTS = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 } };
const isLive = media => { const tracks = media?.getTracks?.() || []; return tracks.length > 0 && tracks.every(t => t.readyState !== 'ended'); };
export default function ChatAttachments({ rideId }) {
  const [menu, setMenu] = useState(false), [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0), [busy, setBusy] = useState(false), [sending, setSending] = useState(0), [draft, setDraft] = useState(null);
  const input = useRef(null), recorder = useRef(null), stream = useRef(null), timer = useRef(null), idle = useRef(null), mounted = useRef(true), pending = useRef(false), starting = useRef(false), preview = useRef('');
  const toast = useToast();
  function releaseMic() { clearTimeout(idle.current); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; }
  function stopTracks() { clearInterval(timer.current); releaseMic(); }
  function keepMicWarm() { clearInterval(timer.current); clearTimeout(idle.current); idle.current = setTimeout(releaseMic, MIC_IDLE_MS); }
  function clearDraft() { if (preview.current) URL.revokeObjectURL(preview.current); preview.current = ''; setDraft(null); }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; held.current = false; if (recorder.current?.state === 'recording') { mode.current = 'discard'; recorder.current.stop(); } stopTracks(); if (preview.current) URL.revokeObjectURL(preview.current); }; }, []);
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
  // Les vocaux partent en parallèle : l'envoi d'un vocal ne bloque jamais l'enregistrement du suivant.
  async function sendVoice(file, duration) {
    setSending(n => n + 1);
    try { await request(`/api/rides/${rideId}/attachment`, { mime: file.type, data: await toBase64(file), duration }); }
    catch (err) { toast(err.message || 'Échec de l’envoi du vocal', 'error'); }
    finally { if (mounted.current) setSending(n => Math.max(0, n - 1)); }
  }
  const mode = useRef('discard'), held = useRef(false), startX = useRef(0), startedAt = useRef(0);
  const [slide, setSlide] = useState(0), [finger, setFinger] = useState(null), [reach, setReach] = useState(160);
  const endX = useRef(0), xMark = useRef(null);
  async function startRecording() {
    if (starting.current || recorder.current?.state === 'recording') return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { toast('Les vocaux ne sont pas disponibles dans ce navigateur.', 'error'); return; }
    starting.current = true; clearTimeout(idle.current);
    try {
      const media = isLive(stream.current) ? stream.current : await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      if (!mounted.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      if (!held.current) { keepMicWarm(); toast('Maintenez le bouton pour parler.', 'info', 2000); return; }
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('Format audio non pris en charge');
      const rec = new MediaRecorder(media, { mimeType, audioBitsPerSecond: 96000 });
      recorder.current = rec; mode.current = 'discard';
      const chunks = [], started = Date.now(); startedAt.current = started;
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        if (!mounted.current) { stopTracks(); return; }
        keepMicWarm();
        setRecording(false); setSlide(0);
        if (mode.current !== 'send') return;
        const duration = Math.min(60, Math.round((Date.now() - started) / 1000));
        const file = new Blob(chunks, { type: rec.mimeType });
        if (Date.now() - started < 1000) { toast('Vocal trop court : maintenez pour parler.', 'error'); return; }
        if (!file.size || file.size > 1024 * 1024) { toast('Enregistrement vide ou trop volumineux.', 'error'); return; }
        sendVoice(file, Math.max(1, duration));
      };
      rec.onerror = () => { stopTracks(); if (mounted.current) { setRecording(false); setSlide(0); toast('Enregistrement interrompu.', 'error'); } };
      rec.start(); setRecording(true); setSeconds(0); setMenu(false);
      timer.current = setInterval(() => { const n = Math.floor((Date.now() - started) / 1000); setSeconds(Math.min(60, n)); if (n >= 60 && rec.state === 'recording') { mode.current = 'send'; rec.stop(); } }, 250);
    } catch (err) { stopTracks(); toast(err.name === 'NotAllowedError' ? 'Autorisez le microphone pour enregistrer un vocal.' : err.message || 'Microphone indisponible', 'error'); }
    finally { starting.current = false; }
  }
  function finish(send) {
    held.current = false;
    const rec = recorder.current;
    if (rec?.state === 'recording') { mode.current = send ? 'send' : 'discard'; rec.stop(); }
    setSlide(0); setFinger(null);
  }
  function onMicDown(e) {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    held.current = true; startX.current = e.clientX ?? 0; setSlide(0);
    const box = e.currentTarget.closest('.chat-attachments')?.getBoundingClientRect();
    // Supprimé seulement quand le doigt atteint la croix, tout au bout de la barre.
    endX.current = (box ? box.left : 0) + 46; setReach(Math.max(1, startX.current - endX.current));
    setFinger({ x: e.clientX ?? 0, y: box ? box.top : (e.clientY ?? 0) });
    startRecording();
  }
  function onMicMove(e) {
    if (!held.current) return;
    const x = e.clientX ?? startX.current;
    const mark = xMark.current?.getBoundingClientRect();
    if (mark && mark.width) endX.current = mark.right;
    const max = Math.max(1, startX.current - endX.current);
    if (x <= endX.current) { try { navigator.vibrate?.(30); } catch {} finish(false); return; }
    setReach(max); setSlide(Math.min(Math.max(0, startX.current - x), max));
    setFinger(f => f && { ...f, x });
  }
  function onMicUp(e) {
    if (!held.current) return;
    const x = e.clientX ?? startX.current;
    finish(x > endX.current);
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
  const progress = Math.min(1, slide / reach), cancelling = progress >= 0.85;
  return <div className={`chat-attachments${recording ? ' is-recording' : ''}`}>
    {draft ? <div className="chat-voice-preview"><audio controls src={draft.url} aria-label="Écouter le vocal avant envoi" /><button type="button" className="btn btn-ghost btn-icon" aria-label="Supprimer le vocal" disabled={busy} onClick={clearDraft}><X size={18} /></button><button type="button" className="btn btn-primary btn-icon" aria-label="Envoyer le vocal" disabled={busy} onClick={() => upload(draft.file, draft.duration)}><Send size={18} /></button></div> : <>
      {!recording && <button type="button" className="btn btn-ghost btn-icon" aria-label={menu ? 'Fermer les pièces jointes' : 'Ajouter une pièce jointe'} aria-expanded={menu} disabled={busy} onClick={() => setMenu(!menu)}><Plus size={20} /></button>}
      {!recording && <span className="chat-att-spacer" />}
      {recording && <div className={`chat-rec-bar${cancelling ? ' is-cancel' : ''}`} role="status" style={{ '--rec-progress': progress }} onPointerMove={onMicMove} onPointerUp={onMicUp} onPointerCancel={() => finish(false)}>
        <span className="chat-rec-fill" aria-hidden="true" />
        <span ref={xMark} className="chat-rec-x" aria-hidden="true"><X size={16} strokeWidth={3} /></span>
        <span className="chat-rec-hint" style={{ transform: `translateX(${-slide * 0.5}px)`, opacity: Math.max(0, 1 - progress * 1.3) }}><ChevronsLeft size={18} /> Glisser jusqu’au bout pour supprimer</span>
      </div>}
      <button type="button" className={`chat-mic${recording ? ' is-recording' : ''}${cancelling ? ' is-cancel' : ''}`} aria-label="Enregistrer un vocal" title="Maintenir pour parler" onPointerDown={onMicDown} onPointerMove={onMicMove} onPointerUp={onMicUp} onPointerCancel={() => finish(false)} onContextMenu={e => e.preventDefault()}><AudioLines size={24} /></button>
      {recording && finger && typeof document !== 'undefined' && createPortal(<div className={`chat-rec-bubble${cancelling ? ' is-cancel' : ''}`} aria-hidden="true" style={{ left: Math.max(56, Math.min(finger.x, (window.innerWidth || 400) - 56)), top: finger.y - 64 }}>
        <svg viewBox="0 0 100 100" className="chat-rec-ring"><circle className="chat-rec-track" cx="50" cy="50" r="45" /><circle className="chat-rec-progress" cx="50" cy="50" r="45" /></svg>
        {cancelling ? <Trash2 size={30} /> : <><span className="chat-rec-dots"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></span><span className="chat-rec-time">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></>}
      </div>, document.body)}
      {(busy || sending > 0) && !recording && <span role="status" className="tiny">Envoi…</span>}
      {menu && <div className="chat-attachment-menu"><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => input.current?.click()}><Image size={18} /> Envoyer une image</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={shareLocation}><MapPin size={18} /> Partager ma position</button></div>}
    </>}
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (file.size > 4 * 1024 * 1024) { toast('Image trop volumineuse : 4 Mo maximum.', 'error'); return; } upload(file); }} />
  </div>;
}
