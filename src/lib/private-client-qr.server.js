import { createHmac, timingSafeEqual } from 'node:crypto';

// Tokens change on fixed five-minute boundaries. The signing key stays on the server.
export const PRIVATE_CLIENT_QR_WINDOW_MS = 5 * 60 * 1000;
const DRIVER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function requireSecret(secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Clé de signature des invitations indisponible');
  }
}

export function createPrivateClientQr(driverId, secret, now = Date.now()) {
  requireSecret(secret);
  if (typeof driverId !== 'string' || !DRIVER_ID.test(driverId) || !Number.isSafeInteger(now) || now < 0) {
    throw new Error('Invitation invalide');
  }
  const slot = Math.floor(now / PRIVATE_CLIENT_QR_WINDOW_MS);
  const payload = `${driverId.toLowerCase()}.${slot}`;
  return { token: `${payload}.${signature(payload, secret)}`, expiresAt: (slot + 1) * PRIVATE_CLIENT_QR_WINDOW_MS };
}

export function verifyPrivateClientQr(token, secret, now = Date.now()) {
  requireSecret(secret);
  if (typeof token !== 'string' || token.length > 128 || !Number.isSafeInteger(now) || now < 0) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !DRIVER_ID.test(parts[0]) || !/^(0|[1-9]\d*)$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) return null;
  const slot = Number(parts[1]);
  if (!Number.isSafeInteger(slot) || slot !== Math.floor(now / PRIVATE_CLIENT_QR_WINDOW_MS)) return null;
  const expected = Buffer.from(signature(`${parts[0]}.${parts[1]}`, secret));
  const received = Buffer.from(parts[2]);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return { driverId: parts[0].toLowerCase(), expiresAt: (slot + 1) * PRIVATE_CLIENT_QR_WINDOW_MS };
}
