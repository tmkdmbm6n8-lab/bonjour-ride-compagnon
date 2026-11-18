import { createHash } from 'node:crypto';

const TOPIC = 'admin_support_archive';
const INTERNAL_EMAIL = 'internal-support-archive@strasdrive.invalid';
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const required = (result) => { if (result.error) throw new Error(result.error.message); return result.data; };
const fingerprint = (message) => createHash('sha256').update(message || '').digest('hex');

export function archivedIds(rows, markers) {
  const known = new Map(rows.map((row) => [row.id, row]));
  const ids = new Set();
  for (const marker of markers) {
    try {
      const info = JSON.parse(marker.message);
      const row = known.get(info.id);
      if (uuid(info.id) && row && fingerprint(row.message) === info.fingerprint) ids.add(info.id);
    } catch { /* Ignore invalid markers; never hide a message on parse errors. */ }
  }
  return ids;
}

export async function archiveSupport(admin, id, expectedMessage) {
  if (!uuid(id) || typeof expectedMessage !== 'string') throw new Error('Conversation invalide');
  const row = required(await admin.from('contact_messages').select('*').eq('id', id).single());
  if (!row || ['ride_chat_archive', 'ride_chat_cleanup', TOPIC].includes(row.topic)) throw new Error('Conversation inaccessible');
  if (row.message !== expectedMessage) throw new Error('Un nouveau message est arrivé. Relisez la conversation avant de l’archiver.');
  const name = `Archive ${id}`;
  const markers = required(await admin.from('contact_messages').select('id').eq('topic', TOPIC).eq('name', name));
  const value = { name, email: INTERNAL_EMAIL, topic: TOPIC, status: 'resolved', resolved_at: new Date().toISOString(), message: JSON.stringify({ id, fingerprint: fingerprint(row.message) }) };
  if (markers.length) required(await admin.from('contact_messages').update(value).eq('id', markers[0].id));
  else required(await admin.from('contact_messages').insert(value));
  return { ok: true };
}

export async function adminSupportMessages(admin, status) {
  const rows = required(await admin.from('contact_messages').select('*')
    .not('topic', 'in', `(ride_chat_archive,ride_chat_cleanup,${TOPIC})`));
  const markers = required(await admin.from('contact_messages').select('message').eq('topic', TOPIC));
  const archived = archivedIds(rows, markers);
  return { messages: rows.filter((row) => status === 'archive' ? archived.has(row.id) : !archived.has(row.id) && row.status === status)
    .map((row) => ({ ...row, _id: row.id, createdAt: row.created_at, resolvedAt: row.resolved_at })) };
}
