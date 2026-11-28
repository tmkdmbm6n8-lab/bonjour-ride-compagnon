// Notification sounds synthesized with Web Audio (no audio files). Each event has its own melody
// so the driver and the rider can tell them apart without looking at the screen.

let ctx = null;
let resumePending = null;
let failedContext = null;
function replaceAudio(c) {
  if (ctx !== c) return audio();
  ctx = null;
  resumePending = null;
  failedContext = null;
  try { if (c.state !== 'closed') void c.close().catch(() => {}); } catch { /* interrupted */ }
  return audio();
}
function audio() {
  if (typeof window === 'undefined') return null;
  if (!ctx || ctx.state === 'closed') {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    resumePending = null;
  }
  return ctx;
}
function resumeAudio(c) {
  if (c.state === 'running') return Promise.resolve(true);
  if (resumePending?.context === c) return resumePending.promise;
  const promise = new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 500);
    Promise.resolve(c.resume()).then(() => {
      clearTimeout(timer); resolve(c.state === 'running');
    }, error => {
      clearTimeout(timer); console.warn('[StrasDrive audio] resume', error); resolve(false);
    });
  });
  resumePending = { context: c, promise };
  promise.then(() => { if (resumePending?.promise === promise) resumePending = null; });
  return promise;
}
function unlock(event) {
  try {
    let c = audio();
    if (!c) return;
    if (failedContext === c && event?.isTrusted && ['pointerdown','touchend','keydown'].includes(event.type)) c = replaceAudio(c);
    if (!c || c.state === 'running') return;
    // Call resume synchronously within the user gesture for iOS.
    void resumeAudio(c).then(ok => { if (ctx === c) failedContext = ok ? null : c; });
    const b = c.createBuffer(1, 1, 22050);
    const source = c.createBufferSource();
    source.buffer = b; source.connect(c.destination);
    source.onended = () => source.disconnect();
    source.start(0);
  } catch (error) { console.warn('[StrasDrive audio] unlock', error); }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchend', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  window.addEventListener('pageshow', unlock);
  window.addEventListener('focus', unlock);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlock();
  });
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
  'ui-click': [[240,0,.32,.45]],
  'offer-accepted': [[440,0,.7],[660,.08,.7]],
  'offer-dismissed': [[110,0,.35],[220,.12,.4]],
  'driver-online': [[261.63, 0, 0.7], [392, 0.15, 0.7], [523.25, 0.30, 0.7], [659.25, 0.45, 0.9]],
  'driver-offline': [[659.25, 0, 0.7], [523.25, 0.15, 0.7], [392, 0.30, 0.7], [261.63, 0.45, 0.9]],
  offer: [[110, 0, 0.55], [165, 0.15, 0.55], [262, 0.30, 0.55], [440, 0.45, 0.35]],
  'destination-offer': [[138.59, 0, 0.55], [207.89, 0.15, 0.55], [330.1, 0.30, 0.55], [554.37, 0.45, 0.35]],
  'driver-found': [[349,0,0.7],[523,0.12,0.85]],
  'arrived': [[349,0,0.7],[523,0.12,0.7],[659,0.36,0.85]],
  'started': [[262,0,0.55],[349,0.12,0.55],[523,0.24,0.85]],
  'message': [[440,0,0.15],[660,0.06,0.32]],
  'cancelled': [[440,0,0.18],[349,0.14,0.18],[174.5,0.28,0.55]],
  'completed': [[196,0,0.8],[392,0.1,0.8],[294,0.35,1]],
};

const VIBRATIONS = {
  offer: [200, 100, 200, 100, 400],
  'destination-offer': [200, 100, 200, 100, 400],
  'driver-found': [150, 80, 150],
  arrived: [300, 120, 300],
  message: [80],
  cancelled: [400],
};

// Dedicated alert bus: boost only the three approved driver sounds.
function driverAlertBus(c, gain) {
  const master = c.createGain();
  master.gain.value = gain;
  // Soft peak ceiling; linear below 0.8, smooth saturation above it.
  const limiter = c.createWaveShaper();
  const curve = new Float32Array(4097);
  for (let i = 0; i < curve.length; i++) {
    const x = 2 * i / (curve.length - 1) - 1;
    const a = Math.abs(x);
    curve[i] = Math.sign(x) * (a <= .8 ? a : .8 + .15 * Math.tanh((a - .8) / .15));
  }
  limiter.curve = curve;
  limiter.oversample = '2x';
  master.connect(limiter); limiter.connect(c.destination);
  let closed = false;
  return { master, disconnect() {
    if (closed) return;
    closed = true;
    master.disconnect(); limiter.disconnect();
  } };
}

export function playSound(kind) {
  if (!MELODIES[kind]) return;
  try { if (kind !== 'ui-click') navigator.vibrate?.(VIBRATIONS[kind] || 0); } catch { /* unsupported */ }
  let cancelled = false, stop;
  const attempt = async () => {
    try {
      let c = audio();
      if (!c) return;
      if (c.state !== 'running' && !await resumeAudio(c)) {
        if (cancelled) return;
        // Recreate a persistently suspended/interrupted context while visible.
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        c = replaceAudio(c);
        if (!c || !await resumeAudio(c)) {
          if (c && ctx === c) failedContext = c;
          console.warn('[StrasDrive audio] unavailable', kind, c?.state);
          return;
        }
      }
      if (!cancelled && ctx === c && c.state === 'running') { failedContext = null; stop = renderSound(kind, c); }
    } catch (error) { console.warn('[StrasDrive audio] playback', kind, error); }
  };
  void attempt();
  return () => { cancelled = true; if (typeof stop === 'function') stop(); };
}

function renderSound(kind, c) {
  const melody = MELODIES[kind];
  const t0 = c.currentTime + 0.02;
  if (['driver-found','arrived','started','cancelled','message','completed','ui-click'].includes(kind)) {
    const click = kind === 'ui-click', msg = kind === 'message';
    const deep = kind === 'cancelled' || kind === 'completed';
    const master = c.createGain(), comp = c.createDynamicsCompressor(), out = c.createGain();
    master.gain.value = click || msg ? 1.8 : 1.65;
    comp.threshold.value = click || msg ? -5 : -4; comp.ratio.value = 12;
    out.gain.value = click ? .5 : 1;
    master.connect(comp); comp.connect(out); out.connect(c.destination);
    const layers = click ? [[1,.2],[.5,.07]] : msg ? [[1,.19],[.5,.12],[2,.025]] : deep ? [[1,.18],[.5,.12],[2,.025]] : [[1,.16],[.5,.075],[2,.025],[1.5,.025]];
    const attack = click ? .02 : msg ? .008 : deep ? .025 : .035;
    function note(f,a,d,glide=1,vol=1) {
      for (const [h,amp] of layers) {
        const o=c.createOscillator(), g=c.createGain(), at=t0+a;
        o.type='sine'; o.frequency.setValueAtTime(f*h*glide,at);
        if(glide!==1) o.frequency.exponentialRampToValueAtTime(f*h,at+Math.min(.12,d*.6));
        g.gain.setValueAtTime(.00001,at);
        g.gain.exponentialRampToValueAtTime(amp*vol,at+attack);
        g.gain.exponentialRampToValueAtTime(.00001,at+d);
        o.connect(g); g.connect(master); o.start(at); o.stop(at+d+.03);
        o.onended=()=>{o.disconnect();g.disconnect();};
      }
    }
    for(const n of melody) note(...n);
    if(!click&&!msg) {
      const [f,a,d]=melody[melody.length-1];
      note(f,a+.33,d,1,kind==='cancelled'?.05:.08);
      if(kind!=='cancelled') note(f,a+.66,d,1,.008);
    }
    setTimeout(()=>{master.disconnect();comp.disconnect();out.disconnect();},click||msg?1000:3000);
    return;
  }
  if (kind === 'offer-accepted' || kind === 'offer-dismissed') {
    const master = c.createGain();
    master.gain.value = .95;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -4; limiter.knee.value = 5; limiter.ratio.value = 16;
    master.connect(limiter); limiter.connect(c.destination);
    const zen = kind === 'offer-accepted';
    function voice(f, at, d, v, h, glide = 1) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f*h*glide, at);
      o.frequency.exponentialRampToValueAtTime(f*h, at+Math.min(.12,d*.6));
      g.gain.setValueAtTime(.0001, at);
      g.gain.exponentialRampToValueAtTime(v, at+.012);
      g.gain.exponentialRampToValueAtTime(v*.35, at+d*.45);
      g.gain.exponentialRampToValueAtTime(.0001, at+d);
      o.connect(g); g.connect(master);
      o.onended = () => { o.disconnect(); g.disconnect(); };
      o.start(at); o.stop(at+d+.03);
    }
    for (const [f,a,d] of melody) {
      const at = t0+a;
      voice(f,at,d,.38,1,zen?1:1.5);
      voice(f,at,d,.15,.5);
      voice(f,at,d*.65,.09,2);
      if (zen) voice(f,at,d*.8,.08,1.5);
    }
    setTimeout(() => { master.disconnect(); limiter.disconnect(); }, 1500);
    return;
  }
  if (kind === 'offer' || kind === 'destination-offer') {
    const bus = driverAlertBus(c, 0.85 * 4);
    const { master } = bus;
    function note(f, offset, volume, dur) {
      if (volume < 0.001) return;
      const at = t0 + offset;
      for (const [h, v] of [[1, .16], [.5, .07], [2, .035], [1.5, .025]]) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f * h;
        g.gain.setValueAtTime(.00001, at);
        g.gain.exponentialRampToValueAtTime(Math.max(.00002, v * volume), at + .015);
        g.gain.exponentialRampToValueAtTime(.00001, at + dur);
        o.connect(g); g.connect(master);
        o.start(at); o.stop(at + dur + .03);
      }
    }
    for (const [f, at, dur] of melody) note(f, at, 1, dur);
    for (let i = 0; i < 3; i++) note(melody[melody.length - 1][0], .45 + (i + 1) * .33, (kind === 'destination-offer' ? .12 : .08) * Math.pow(.1, i), .35);
    const cleanup = setTimeout(() => bus.disconnect(), 2000);
    return () => { clearTimeout(cleanup); master.gain.setTargetAtTime(0, c.currentTime, .015); setTimeout(() => bus.disconnect(), 100); };
  }
  if (kind === 'driver-online' || kind === 'driver-offline') {
    const bus = driverAlertBus(c, 3);
    function note(f, at, dur, volume = 1) {
      const start = t0 + at;
      for (const [harmonic, gain] of [[1, .12], [2, .025], [.5, .045]]) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f * harmonic;
        g.gain.setValueAtTime(.0001, start);
        g.gain.exponentialRampToValueAtTime(Math.max(.00011, gain * volume), start + .035);
        g.gain.exponentialRampToValueAtTime(.0001, start + dur);
        o.connect(g); g.connect(bus.master);
        o.onended = () => { o.disconnect(); g.disconnect(); };
        o.start(start); o.stop(start + dur + .02);
      }
    }
    for (const [f, at, dur] of melody) note(f, at, dur);
    if (kind === 'driver-online') note(659.25, .45 + .33, .9, .04);
    else note(261.63, .45 + .33, .9, .04);
    setTimeout(() => bus.disconnect(), 2000);
    return;
  }
  for (const [f, at, dur] of melody) tone(c, f, t0 + at, dur, { type: kind === 'offer' ? 'triangle' : 'sine', gain: kind === 'message' ? 0.16 : 0.24 });
}

/** Ring repeatedly (incoming ride request) until the returned stop() is called. */
export function startRinging(kind = 'offer', everyMs = 1800) {
  let cancel = playSound(kind);
  const id = setInterval(() => { if (typeof cancel === 'function') cancel(); cancel = playSound(kind); }, (kind === 'offer' || kind === 'destination-offer') ? 2990 : everyMs);
  return () => { clearInterval(id); if (typeof cancel === 'function') cancel(); };
}

/** Radar and police audio disabled; retain compatibility with navigation callers. */
export function playRadarBeep() {
  // Intentionally silent.
}

 // Delegated UI feedback: actual interactive controls only, not map gestures or text.
 if (typeof document !== 'undefined') {
   document.addEventListener('click', event => {
     if (event.defaultPrevented && !event.target?.closest?.('a,button,[role="button"]')) return;
     const el = event.target?.closest?.('button,a[href],[role="button"],[role="tab"],[role="switch"],[role="menuitem"],input[type="checkbox"],input[type="radio"],select,summary');
     if (!el || el.closest('[disabled],[aria-disabled="true"],[data-no-click-sound],.sd-close-control,.drv-go-btn:not(.vehicle-needed),.driver-incoming-accept,.driver-incoming-refuse,.driver-desktop-status button,.mapboxgl-map,.leaflet-container,.maplibregl-map')) return;
     if (/^(retour|fermer|accepter|refuser|passer hors ligne|passer en ligne)$/i.test((el.getAttribute('aria-label')||el.textContent||'').trim())) return;
     playSound('ui-click');
   }, true);
 }
