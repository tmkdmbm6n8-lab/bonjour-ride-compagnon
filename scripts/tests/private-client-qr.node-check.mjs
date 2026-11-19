import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateClientQr, verifyPrivateClientQr, PRIVATE_CLIENT_QR_WINDOW_MS as WINDOW } from '../../src/lib/private-client-qr.server.js';

const secret = 'test-secret-that-is-at-least-32-bytes-long';
const driver = '12345678-1234-4234-8234-123456789abc';

describe('private client QR', () => {
  it('is valid during its five-minute window and expires at the boundary', () => {
    const qr = createPrivateClientQr(driver, secret, WINDOW + 10);
    assert.equal(qr.expiresAt, 2 * WINDOW);
    assert.equal(verifyPrivateClientQr(qr.token, secret, 2 * WINDOW - 1)?.driverId, driver);
    assert.equal(verifyPrivateClientQr(qr.token, secret, 2 * WINDOW), null);
    assert.notEqual(createPrivateClientQr(driver, secret, 2 * WINDOW).token, qr.token);
  });

  it('rejects modified, future, malformed, and incorrectly signed tokens', () => {
    const qr = createPrivateClientQr(driver, secret, WINDOW);
    assert.equal(verifyPrivateClientQr(qr.token.replace(driver, '22345678-1234-4234-8234-123456789abc'), secret, WINDOW), null);
    assert.equal(verifyPrivateClientQr(qr.token, secret, 0), null);
    assert.equal(verifyPrivateClientQr(`${qr.token}.extra`, secret, WINDOW), null);
    assert.equal(verifyPrivateClientQr(qr.token, `${secret}different`, WINDOW), null);
  });

  it('requires a strong server key and a valid driver identifier', () => {
    assert.throws(() => createPrivateClientQr(driver, 'short', 0));
    assert.throws(() => createPrivateClientQr('invalid', secret, 0));
  });
});
