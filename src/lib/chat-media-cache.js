import { apiFetch } from '@/lib/archive-fetch';
// Fichiers de discussion téléchargés une seule fois puis gardés en local : lecture instantanée et notification seulement quand c'est prêt.
const cache = new Map();
const wait = ms => new Promise(r => setTimeout(r, ms));
async function download(rideId, id) {
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await apiFetch(`/api/rides/${encodeURIComponent(rideId)}/media?messageId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'indisponible');
      const file = await fetch(data.url);
      if (!file.ok) throw new Error('indisponible');
      const blob = await file.blob();
      if (!blob.size) throw new Error('vide');
      return URL.createObjectURL(blob);
    } catch (err) { last = err; await wait(Math.min(4000, 600 * 2 ** attempt)); }
  }
  throw last;
}
export function loadChatMedia(rideId, message) {
  const key = `${rideId}:${message.id}`;
  if (!cache.has(key)) cache.set(key, download(rideId, message.id).catch(err => { cache.delete(key); throw err; }));
  return cache.get(key);
}
/** Attend que l'audio/image soit sur le téléphone avant de prévenir (abandonne au bout de ~15 s). */
export async function whenChatMessageReady(rideId, message) {
  if (!['audio', 'image'].includes(message?.type) || !rideId || !message.id) return;
  try { await loadChatMedia(rideId, message); } catch {}
}
