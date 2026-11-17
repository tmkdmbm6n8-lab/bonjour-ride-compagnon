import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

const SPEEDS = [1, 1.5, 2];
const fmt = s => { const n = Math.max(0, Math.round(s || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };

/** Deterministic waveform (bars and dots) so each voice note keeps its own shape. */
function waveform(seed, count = 24) {
  let h = 2166136261;
  for (const ch of String(seed || 'vocal')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Array.from({ length: count }, () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13;
    const r = ((h >>> 0) % 1000) / 1000;
    return r < 0.38 ? 0 : 0.3 + r * 0.7;
  });
}

export default function VoiceNote({ url, duration, seed, onError }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false), [time, setTime] = useState(0), [speed, setSpeed] = useState(1), [total, setTotal] = useState(duration || 0);
  const bars = useMemo(() => waveform(seed), [seed]);
  useEffect(() => { if (audio.current) audio.current.playbackRate = speed; }, [speed]);
  const progress = total ? Math.min(1, time / total) : 0;
  function toggle() {
    const a = audio.current; if (!a) return;
    if (a.paused) { a.playbackRate = speed; a.play().catch(() => onError?.()); } else a.pause();
  }
  function seek(e) {
    const a = audio.current; if (!a || !total) return;
    const box = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * total;
    try { a.currentTime = t; setTime(t); } catch {}
  }
  return <div className="voice-note">
    <audio ref={audio} src={url} preload="metadata" onError={onError}
      onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setTotal(d); }}
      onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onEnded={() => { setPlaying(false); setTime(0); }} />
    <button type="button" className="voice-note-play" onClick={toggle} aria-label={playing ? 'Mettre en pause le vocal' : 'Écouter le vocal'}>
      {playing ? <Pause size={18} fill="currentColor" strokeWidth={0} /> : <Play size={18} style={{ marginLeft: 2 }} fill="currentColor" strokeWidth={0} />}
    </button>
    <div className="voice-note-wave" onClick={seek} role="slider" aria-label="Position dans le vocal" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(time)} tabIndex={-1}>
      {bars.map((v, i) => <i key={i} className={(i + 0.5) / bars.length <= progress ? 'is-played' : ''} style={v ? { height: `${Math.round(v * 100)}%` } : undefined} data-dot={v ? undefined : ''} />)}
    </div>
    <button type="button" className="voice-note-speed" onClick={() => setSpeed(s => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])} aria-label="Vitesse de lecture">{String(speed).replace('.', ',')}x</button>
    <span className="voice-note-time">{fmt(playing || time ? time : total)}</span>
  </div>;
}
