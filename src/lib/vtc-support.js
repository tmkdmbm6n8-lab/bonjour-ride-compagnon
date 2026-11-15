const FORMAT = 'strasdrive_support_v1';
export function parseSupportThread(row) {
  try {
    const value = JSON.parse(row.message);
    if (row.topic === 'driver_conversation' && value.format === FORMAT && Array.isArray(value.messages)) return { ...value, subject: String(value.subject || 'Assistance'), messages: value.messages.filter((m) => m && ['driver', 'admin'].includes(m.from) && typeof m.text === 'string') };
  } catch { /* Existing contact messages remain readable. */ }
  return { format: FORMAT, userId: null, subject: row.topic || 'Assistance', messages: [{ id: row.id, from: 'driver', text: row.message || '', createdAt: row.created_at }] };
}
export function newSupportThread(userId, subject, text, now = new Date().toISOString()) {
  return { format: FORMAT, userId, subject: String(subject || 'Assistance').trim().slice(0, 160), messages: [{ id: crypto.randomUUID(), from: 'driver', text: String(text || '').trim().slice(0, 4000), createdAt: now }] };
}
export function supportOwnedBy(row, uid, email) {
  const thread = parseSupportThread(row);
  return thread.userId ? thread.userId === uid : Boolean(email && row.email?.toLowerCase() === email.toLowerCase());
}
export function supportShape(row) { const thread = parseSupportThread(row); return { id: row.id, subject: thread.subject, name: row.name, email: row.email, topic: row.topic, status: row.status, createdAt: row.created_at, messages: thread.messages, updatedAt: thread.messages.at(-1)?.createdAt || row.created_at }; }