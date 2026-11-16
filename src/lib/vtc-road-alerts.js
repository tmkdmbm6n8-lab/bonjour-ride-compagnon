// Signalements communautaires (police / radar) — règles pures, testées unitairement.
import { haversineDistance } from "./utils/geo";

export const ALERT_KINDS = ["police", "radar"];
export const RADAR_VALIDATIONS = 10; // chauffeurs distincts pour rendre un radar définitif
export const POLICE_TTL_MS = 45 * 60 * 1000; // une patrouille non reconfirmée disparaît après 45 min
export const RADAR_PENDING_TTL_MS = 7 * 24 * 3600 * 1000; // radar non validé : visible 7 jours
export const DENIALS_TO_REMOVE = 3; // « plus là » : 3 chauffeurs suffisent à retirer un repère non définitif
export const MERGE_RADIUS_M = 60; // même type à moins de 60 m = même repère
export const CONFIRM_RADIUS_M = 250; // on demande « toujours là ? » à moins de 250 m
export const BEEP_START_M = 100; // le bip commence à 100 m
export const NEARBY_RADIUS_KM = 25;

const distM = (a, b) => haversineDistance(a.lat, a.lng, b.lat, b.lng) * 1000;

export function validPoint(p) {
  const lat = Number(p?.lat), lng = Number(p?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Un repère est-il encore affiché ? */
export function isAlertActive(a, now = Date.now()) {
  if (!a) return false;
  if (a.is_permanent) return true;
  if (a.denials >= DENIALS_TO_REMOVE && a.denials >= a.confirmations) return false;
  const last = new Date(a.last_confirmed_at || a.created_at).getTime();
  const ttl = a.kind === "police" ? POLICE_TTL_MS : RADAR_PENDING_TTL_MS;
  return now - last < ttl;
}

/** Effet d'un vote sur le repère. */
export function applyVote(a, present, now = new Date()) {
  const next = { ...a };
  if (present) {
    next.confirmations = (a.confirmations || 0) + 1;
    next.last_confirmed_at = now.toISOString();
    if (a.kind === "radar" && next.confirmations >= RADAR_VALIDATIONS) next.is_permanent = true;
  } else {
    next.denials = (a.denials || 0) + 1;
  }
  return next;
}

/** Repère existant du même type tout proche (pour fusionner un nouveau signalement). */
export function findMergeTarget(alerts, kind, point, now = Date.now()) {
  return alerts.find((a) => a.kind === kind && isAlertActive(a, now) && distM(a, point) <= MERGE_RADIUS_M) || null;
}

/** Intervalle entre deux bips (ms), ou null si trop loin. Accélère tous les 10 m sous 100 m. */
export function beepIntervalMs(distanceM) {
  if (!Number.isFinite(distanceM) || distanceM > BEEP_START_M) return null;
  const step = Math.max(0, Math.ceil(distanceM / 10)); // 10 (100 m) … 1 (≤10 m)
  return Math.max(150, 150 + (step - 1) * 120); // 1230 ms à 100 m → 150 ms à 10 m
}

export function nearestAlert(alerts, pos) {
  if (!pos) return null;
  let best = null;
  for (const a of alerts) {
    const d = distM(a, pos);
    if (!best || d < best.distance) best = { alert: a, distance: d };
  }
  return best;
}

export function alertShape(a, uid, myVote) {
  return {
    id: a.id,
    kind: a.kind,
    lat: a.lat,
    lng: a.lng,
    confirmations: a.confirmations,
    permanent: a.is_permanent,
    mine: a.reported_by === uid,
    voted: myVote != null,
    createdAt: a.created_at,
    lastConfirmedAt: a.last_confirmed_at,
  };
}
