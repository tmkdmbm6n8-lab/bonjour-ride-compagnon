import { rejectInappropriateMessage } from "./message-moderation";

export const CHAT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
export const CHAT_ACTIVE_STATUSES = ['accepted', 'arrived', 'in_progress'];
export const CHAT_NOTICE = 'Textes, vocaux, images et positions sont supprimés à la fin de la course. En cas de signalement avant la fin, ils sont conservés 14 jours à compter du signalement, accessibles à l’administration, puis supprimés.';
export const visibleChatMessages = messages => (Array.isArray(messages) ? messages : []).filter(m => m.type !== 'retention');
export const chatRetention = messages => (Array.isArray(messages) ? messages : []).find(m => m.type === 'retention');
// A narrow first-line safety filter. Reports remain necessary for contextual abuse,
// images and voice notes; do not treat this as comprehensive moderation.
export function rejectUnsafeChatText(value) {
  const text = String(value || '').normalize('NFKC').toLocaleLowerCase('fr');
  const threats = [
    /\bje\s+vais\s+te\s+(?:tuer|violer|frapper)\b/u,
    /\bje\s+te\s+(?:tue|viole|frappe)\b/u,
    /\bi\s+will\s+(?:kill|rape)\s+you\b/u,
  ];
  if (threats.some((pattern) => pattern.test(text)))
    throw new Error('Message bloqué pour menace explicite. Vous pouvez contacter l’assistance.');
}
export function newChatMessage(body, from, now = new Date().toISOString()) {
  const common = { id: crypto.randomUUID(), from, at: now };
  if (body.type === 'location') {
    if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng) || Math.abs(body.lat) > 90 || Math.abs(body.lng) > 180) throw new Error('Position invalide');
    return { ...common, type: 'location', lat: body.lat, lng: body.lng, text: 'Position partagée' };
  }
  if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 500) throw new Error('Message invalide');
  rejectUnsafeChatText(body.text);
  rejectInappropriateMessage(body.text);
  return { ...common, type: 'text', text: body.text.trim() };
}
export function decodeChatAttachment(body) {
  const formats = { 'audio/webm': ['audio', 'webm'], 'audio/ogg': ['audio', 'ogg'], 'audio/mp4': ['audio', 'm4a'], 'image/jpeg': ['image', 'jpg'], 'image/png': ['image', 'png'], 'image/webp': ['image', 'webp'] };
  const mime = String(body.mime || '').split(';')[0].toLowerCase();
  const format = formats[mime];
  if (!format || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.data || '')) throw new Error('Format de fichier non autorisé');
  const maxBytes = format[0] === 'audio' ? 1024 * 1024 : 4 * 1024 * 1024;
  if (body.data.length > Math.ceil(maxBytes / 3) * 4 + 4) throw new Error('Fichier trop volumineux');
  const bytes = Buffer.from(body.data, 'base64');
  if (!bytes.length || bytes.length > maxBytes) throw new Error('Fichier trop volumineux');
  const hex = bytes.subarray(0, 12).toString('hex');
  const magic = mime === 'image/jpeg' ? hex.startsWith('ffd8ff') : mime === 'image/png' ? hex.startsWith('89504e470d0a1a0a') : mime === 'image/webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' : mime === 'audio/webm' ? hex.startsWith('1a45dfa3') : mime === 'audio/ogg' ? bytes.toString('ascii', 0, 4) === 'OggS' : bytes.toString('ascii', 4, 8) === 'ftyp';
  if (!magic) throw new Error('Le contenu ne correspond pas au format annoncé');
  if (format[0] === 'audio' && (!Number.isFinite(body.duration) || body.duration <= 0 || body.duration > 60)) throw new Error('Le vocal est limité à une minute');
  return { bytes, mime, type: format[0], ext: format[1], duration: format[0] === 'audio' ? body.duration : undefined };
}
