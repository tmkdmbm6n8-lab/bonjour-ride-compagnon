import { newSupportThread, parseSupportThread, supportOwnedBy, supportShape } from './vtc-support';
function required(result) { if (result.error) throw new Error(result.error.message); return result.data; }
export async function inboxForDriver(admin, uid, email, page = 1) {
  const start = (Math.max(1, Number(page) || 1) - 1) * 50;
  const escapedEmail = String(email || '').replace(/[\\%_]/g, '\\$&');
  const [support, owned, rides] = await Promise.all([
    email ? admin.from('contact_messages').select('*').ilike('email', escapedEmail).order('created_at', { ascending: false }).range(start, start + 49) : { data: [] },
    admin.from('contact_messages').select('*').eq('topic', 'driver_conversation').like('message', '%"userId":"' + uid + '"%').order('created_at', { ascending: false }).range(start, start + 49),
    admin.from('rides').select('id,created_at,status,pickup,dropoff,messages').eq('driver_id', uid).eq('is_test', false).neq('messages', '[]').order('created_at', { ascending: false }).range(start, start + 49),
  ]);
  const rows = [...new Map([...required(support), ...required(owned)].map((row) => [row.id, row])).values()].filter((row) => supportOwnedBy(row, uid, email));
  return { threads: rows.map(supportShape), rides: required(rides), hasMore: (support.data?.length || 0) === 50 || (owned.data?.length || 0) === 50 || (rides.data?.length || 0) === 50 };
}
export async function sendSupportMessage(admin, { uid, email, name, role, body }) {
  if (!['driver', 'admin'].includes(role)) throw new Error('Accès refusé');
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 4000) throw new Error('Le message doit contenir entre 1 et 4 000 caractères');
  if (!body.id) {
    if (role !== 'driver' || !email) throw new Error('Compte chauffeur et adresse e-mail requis');
    const thread = newSupportThread(uid, body.subject, text);
    const row = required(await admin.from('contact_messages').insert({ name: name || 'Chauffeur', email: email.toLowerCase(), topic: 'driver_conversation', message: JSON.stringify(thread) }).select('*').single());
    return { thread: supportShape(row) };
  }
  if (!/^[0-9a-f-]{36}$/i.test(body.id)) throw new Error('Conversation invalide');
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = required(await admin.from('contact_messages').select('*').eq('id', body.id).single());
    if (role !== 'admin' && !supportOwnedBy(row, uid, email)) throw new Error('Conversation inaccessible');
    const thread = parseSupportThread(row);
    if (thread.messages.length >= 500) throw new Error('Cette conversation est pleine. Ouvrez une nouvelle demande.');
    thread.messages.push({ id: crypto.randomUUID(), from: role === 'admin' ? 'admin' : 'driver', text, createdAt: new Date().toISOString() });
    const updated = required(await admin.from('contact_messages').update({ topic: 'driver_conversation', message: JSON.stringify(thread), status: 'open', resolved_at: null }).eq('id', row.id).eq('message', row.message).select('*'));
    if (updated.length) return { thread: supportShape(updated[0]) };
  }
  throw new Error('Un autre message vient d’arriver. Réessayez l’envoi.');
}