// Signalements communautaires (police / radar) — règles pures, testées unitairement.
import { haversineDistance } from "./utils/geo";

export const ALERT_KINDS = ["police", "radar"];
export const POLICE_TTL_MS = 2 * 3600 * 1000; // une patrouille disparaît 2 h après son dernier signalement
export const DENIALS_TO_REMOVE = 3; // « plus là » : 3 chauffeurs suffisent à retirer une patrouille
export const MERGE_RADIUS_M = 60; // même type à moins de 60 m = même repère
export const CONFIRM_RADIUS_M = 250; // on demande « toujours là ? » à moins de 250 m (police uniquement)
export const BEEP_START_M = 100; // le bip commence à 100 m
export const NEARBY_RADIUS_KM = 25;

const distM = (a, b) => haversineDistance(a.lat, a.lng, b.lat, b.lng) * 1000;

export function validPoint(p) {
  const lat = Number(p?.lat), lng = Number(p?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Un radar est fixe : il reste jusqu'à ce que l'administrateur le supprime. */
export function isPermanent(a) {
  return a?.kind === "radar" || Boolean(a?.is_permanent);
}

/** Un repère est-il encore affiché ? */
export function isAlertActive(a, now = Date.now()) {
  if (!a) return false;
  if (isPermanent(a)) return true;
  if (a.denials >= DENIALS_TO_REMOVE && a.denials >= a.confirmations) return false;
  const last = new Date(a.last_confirmed_at || a.created_at).getTime();
  return now - last < POLICE_TTL_MS;
}

/** Effet d'un vote sur le repère. */
export function applyVote(a, present, now = new Date()) {
  const next = { ...a };
  if (present) {
    next.confirmations = (a.confirmations || 0) + 1;
    next.last_confirmed_at = now.toISOString();
  } else {
    next.denials = (a.denials || 0) + 1;
  }
  next.is_permanent = isPermanent(a);
  return next;
}

/** Repère existant du même type tout proche (pour fusionner un nouveau signalement). */
export function findMergeTarget(alerts, kind, point, now = Date.now()) {
  return alerts.find((a) => a.kind === kind && isAlertActive(a, now) && distM(a, point) <= MERGE_RADIUS_M) || null;
}

/** Intervalle entre deux bips (ms), ou null si trop loin. Doux et espacé, il accélère tous les 10 m sous 100 m. */
export function beepIntervalMs(distanceM) {
  if (!Number.isFinite(distanceM) || distanceM > BEEP_START_M) return null;
  const step = Math.min(10, Math.max(1, Math.ceil(distanceM / 10))); // 10 (100 m) … 1 (≤10 m)
  return 800 + (step - 1) * 200; // 2,6 s à 100 m → 0,8 s à 10 m
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

/**
 * Repère qui doit biper : le plus proche à moins de 100 m, sauf ceux que ce chauffeur vient de signaler.
 * Un repère signalé redevient « bipable » une fois que le chauffeur s'en est éloigné de plus de 100 m.
 * Renvoie { target, silenced } (silenced = nouvel ensemble d'identifiants encore muets).
 */
export function beepTarget(alerts, pos, silenced = new Set()) {
  const still = new Set();
  for (const id of silenced) {
    const a = alerts.find((x) => x.id === id);
    if (a && pos && distM(a, pos) <= BEEP_START_M) still.add(id);
    else if (!a || !pos) still.add(id);
  }
  const n = nearestAlert(
    alerts.filter((a) => !still.has(a.id)),
    pos,
  );
  return { target: n && n.distance <= BEEP_START_M ? n : null, silenced: still };
}

export function alertShape(a, uid, myVote) {
  return {
    id: a.id,
    kind: a.kind,
    lat: a.lat,
    lng: a.lng,
    confirmations: a.confirmations,
    permanent: isPermanent(a),
    mine: a.reported_by === uid,
    voted: myVote != null,
    createdAt: a.created_at,
    lastConfirmedAt: a.last_confirmed_at,
  };
}
