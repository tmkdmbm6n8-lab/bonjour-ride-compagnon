import { parisInstant, shiftDay, validDay } from './vtc-dates.js';
export function adminRideDateRange(day) {
  if (!validDay(day)) throw new Error('Date invalide');
  return { from: parisInstant(day), to: parisInstant(shiftDay(day,1)) };
}
export function recordPerson(profile) {
  return profile ? { id:profile.id, name:profile.name || '', phone:profile.phone || '', username:profile.username || '' } : null;
}
// Une archive scellée est la seule source de ses champs historiques : jamais de retour aux profils actuels.
export function sealedRide(a) {
  const x = a.accounting || {}, b = a.booking || null;
  return { id:a.ride_id, status:x.status, created_at:x.createdAt, accepted_at:x.acceptedAt, arrived_at:x.arrivedAt, completed_at:x.completedAt,
    pickup:b?.pickup||null, dropoff:b?.dropoff||null, vehicle_type:x.vehicleType, route:b?.route||{}, fare:x.fare, payment:x.payment,
    rating:b?.rating||{}, messages:[], rider_id:x.riderId, driver_id:x.driverId, is_test:false };
}
export function sealedParts(a) {
  const erased = Boolean(a.personal_erased_at) || !a.contacts || !a.booking;
  const b = erased ? null : a.booking;
  return {
    ride: sealedRide(erased ? { ...a, booking:null } : a),
    rider: erased ? null : recordPerson(a.contacts.rider),
    driver: erased ? null : recordPerson(a.contacts.driver),
    vehicle: b?.vehicle || null,
    operator: b?.vehicle?.operator,
    documents: Array.isArray(b?.documents) ? b.documents : [],
    reservationSource: erased ? 'erased' : b?.waybillSealed ? 'sealed' : 'sealed-partial',
    erased,
  };
}
// Écart entre la course actuelle et le dossier figé, signalé à part, sans jamais remplacer l'archive.
export function currentDiff(current, archived) {
  if (!current) return null;
  const differs = current.status !== archived.status || Number(current.fare?.total) !== Number(archived.fare?.total)
    || (current.payment?.method || null) !== (archived.payment?.method || null);
  return { status:current.status, fareTotal:current.fare?.total ?? null, paymentMethod:current.payment?.method || null, differs };
}
export function archiveListRow(a) {
  const x = a.accounting || {}, erased = Boolean(a.personal_erased_at) || !a.contacts || !a.booking;
  const name = (p) => erased ? 'Coordonnées effacées' : p?.name || '—';
  return { _id:a.ride_id, id:a.ride_id, createdAt:a.ride_created_at, completedAt:x.completedAt || null, status:a.final_status,
    vehicleType:x.vehicleType, fare:x.fare, payment:x.payment,
    pickup:{ address: erased ? 'Adresse effacée' : a.booking?.pickup?.address || '' },
    dropoff:{ address: erased ? 'Adresse effacée' : a.booking?.dropoff?.address || '' },
    riderId:{ name:name(a.contacts?.rider) }, driverId: x.driverId ? { name:name(a.contacts?.driver) } : null,
    archived:true, source:'archive' };
}
