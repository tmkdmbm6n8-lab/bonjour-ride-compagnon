// Notification sounds synthesized with Web Audio (no audio files). Each event has its own melody
// so the driver and the rider can tell them apart without looking at the screen.

let ctx = null;

function audio() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Browsers only allow sound after a first touch/click: unlock on the first interaction.
if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = audio();
    if (c) {
      const b = c.createBuffer(1, 1, 22050);
      const s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0);
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function tone(c, freq, at, dur, { type = 'sine', gain = 0.22 } = {}) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(c.destination);
  o.start(at); o.stop(at + dur + 0.05);
  // soft octave overtone for a bell-like timbre
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(freq * 2, at);
  g2.gain.setValueAtTime(0.0001, at);
  g2.gain.exponentialRampToValueAtTime(gain * 0.25, at + 0.01);
  g2.gain.exponentialRampToValueAtTime(0.0001, at + dur * 0.6);
  o2.connect(g2); g2.connect(c.destination);
  o2.start(at); o2.stop(at + dur + 0.05);
}

// [frequency Hz, start offset s, duration s]
export const MELODIES = {
  offer: [[659, 0, 0.18], [831, 0.16, 0.18], [988, 0.32, 0.18], [1319, 0.48, 0.42]],
  'driver-found': [[784, 0, 0.22], [1175, 0.2, 0.5]],
  arrived: [[1047, 0, 0.2], [1047, 0.24, 0.2], [1319, 0.48, 0.55]],
  started: [[880, 0, 0.18], [1109, 0.16, 0.4]],
  message: [[1568, 0, 0.09], [1976, 0.11, 0.14]],
  cancelled: [[784, 0, 0.25], [523, 0.24, 0.45]],
  completed: [[784, 0, 0.18], [988, 0.16, 0.18], [1175, 0.32, 0.5]],
};

const VIBRATIONS = {
  offer: [200, 100, 200, 100, 400],
  'driver-found': [150, 80, 150],
  arrived: [300, 120, 300],
  message: [80],
  cancelled: [400],
};

export function playSound(kind) {
  const melody = MELODIES[kind];
  if (!melody) return;
  try { navigator.vibrate?.(VIBRATIONS[kind] || 0); } catch { /* unsupported */ }
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + 0.02;
  for (const [f, at, dur] of melody) tone(c, f, t0 + at, dur, { type: kind === 'offer' ? 'triangle' : 'sine', gain: kind === 'message' ? 0.16 : 0.24 });
}

/** Ring repeatedly (incoming ride request) until the returned stop() is called. */
export function startRinging(kind = 'offer', everyMs = 1800) {
  playSound(kind);
  const id = setInterval(() => playSound(kind), everyMs);
  return () => clearInterval(id);
}
