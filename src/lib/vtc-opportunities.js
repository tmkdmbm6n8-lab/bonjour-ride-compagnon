function transportReturnHint(ride, flights, kind, { approachSeconds = 0, airportTravelSeconds = 0, nearAirport = false, now = Date.now() } = {}) {
  if (!nearAirport || ride.is_test) return null;
  const airportAt = now + (Math.max(0, approachSeconds) + Math.max(0, Number(ride.route?.durationSeconds) || 0) + Math.max(0, airportTravelSeconds)) * 1000;
  const candidates = flights.filter((flight) => {
    if (flight.direction !== 'arrival' || flight.kind !== kind || !flight.live || flight.status === 'cancelled') return false;
    if (flight.status === 'delayed' && !flight.estimated && !flight.actual) return false;
    const at = Date.parse(flight.actual || flight.estimated || flight.scheduled);
    const fresh = now - Date.parse(flight.updatedAt) <= 15 * 60000;
    return fresh && at >= airportAt - 15 * 60000 && at <= airportAt + 60 * 60000;
  }).sort((a, b) => Date.parse(a.actual || a.estimated || a.scheduled) - Date.parse(b.actual || b.estimated || b.scheduled));
  if (!candidates.length) return null;
  const flight = candidates[0];
  return { title: 'Retour potentiel possible', kind, flightNumber: flight.number, city: flight.city, arrivalAt: flight.actual || flight.estimated || flight.scheduled, statusText: flight.statusText, source: flight.source, updatedAt: flight.updatedAt, message: `Arrivée d’un ${kind === 'train' ? 'train' : 'vol'} à proximité de la fin de course. Une demande de retour reste possible, sans garantie de réservation.` };
}

export function airportReturnHint(ride, flights, options) {
  return transportReturnHint(ride, flights, "flight", options);
}

export function stationReturnHint(ride, trains, options) {
  return transportReturnHint(ride, trains, "train", options);
}
