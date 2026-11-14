// Display helpers shared by rider and driver ride screens.

/** Only real road geometry is drawn: an approximate route (null) or a bare 2-point segment is never shown as a line. */
export function drawableRoute(geometry) {
  return Array.isArray(geometry) && geometry.length > 2 ? geometry : undefined;
}

/** Clock time ("14:32") reached after `seconds` from now. */
export function arrivalClock(seconds, now = new Date()) {
  const at = new Date(now.getTime() + Math.max(0, Number(seconds) || 0) * 1000);
  return at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
}
