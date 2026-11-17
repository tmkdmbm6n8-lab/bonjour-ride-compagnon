import { createHmac } from 'node:crypto';
import { driverReportMessage } from './driver-reports';
const required = result => { if (result.error) throw new Error(result.error.message); return result.data; };

const signature = message => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Service de signalement indisponible');
  return createHmac('sha256', key).update('driver-report:v1:' + message).digest('hex');
};
export function verifiedReport(message) {
  const split = message.lastIndexOf('\nAuthentification : ');
  return split >= 0 && signature(message.slice(0, split)) === message.slice(split + '\nAuthentification : '.length);
}
// Stored with support requests: no schema change or passenger-account restriction.
export async function reportedRideCount(admin, driverId) {
  const rows = required(await admin.from('contact_messages').select('message')
    .eq('topic', 'safety').like('message', `Signalement chauffeur — course %\n%\nChauffeur : ${driverId}\n%`));
  return new Set(rows.filter(row => verifiedReport(row.message) && row.message.split("\n")[2] === `Chauffeur : ${driverId}`).map(row => row.message.split('\n')[0])).size;
}
export async function sendDriverReport(admin, { ride, uid, email, name, body }) {
  const text = driverReportMessage(ride, uid, body);
  const message = `${text}\nAuthentification : ${signature(text)}`;
  if (!email) throw new Error('Une adresse e-mail de compte est nécessaire');
  const previous = required(await admin.from('contact_messages').select('message')
    .eq('email', email).eq('topic', 'safety').like('message', `Signalement chauffeur — course ${ride.id}\n%`).limit(1));
  if (!previous.some(row => verifiedReport(row.message))) required(await admin.from('contact_messages').insert({
    name: name || 'Passager', email, topic: 'safety', message,
  }));
  const count = await reportedRideCount(admin, ride.driver_id);
  if (count >= 3) {
    // Différé de 12 heures pour préserver l'anonymat du passager
    const current = required(await admin.from('drivers').select('stats').eq('user_id', ride.driver_id).single());
    const stats = current.stats || {};
    if (!stats.pending_suspension_at) {
      stats.pending_suspension_at = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      required(await admin.from('drivers').update({
        stats,
        updated_at: new Date().toISOString(),
      }).eq('user_id', ride.driver_id));
    }
  }
  return { ok: true };
}
