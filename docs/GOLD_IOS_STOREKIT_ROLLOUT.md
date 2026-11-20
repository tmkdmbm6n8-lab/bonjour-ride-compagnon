# Native iOS StrasDrive Gold — secure StoreKit rollout

The supplied sample must **not** be deployed as-is. A client-provided `transactionId` is not evidence of payment. Never grant `gold_status=active` or an arbitrary 30-day period from that input.

## Implemented now

- Native iOS is detected using Capacitor.
- Stripe Gold checkout is available only from the Web/Android path; native iOS shows a clear pending-setup message instead of falsely promising Face ID.
- Existing Web/Stripe subscription state remains intact. No unverified Apple endpoint is exposed.

## Required before Apple purchase activation

1. Create the **auto-renewable subscription** and subscription group in App Store Connect, set price, territories, trial/introductory offer, tax and review metadata. Confirm product identifier `fr.strasdrive.app.gold.monthly` and app bundle ID.
2. Choose and install a compatible Capacitor 8 StoreKit 2 plugin in the actual iOS project; run `npx cap sync ios` and test on a physical device. A generic Capacitor plugin import and a `transactionId` do not establish the plugin API contract.
3. Provision App Store Server API credentials (issuer ID, key ID, private key), app Apple ID and environment **on the server only**.
4. On receipt of an Apple purchase, verify the signed transaction using Apple's App Store Server API/JWS signature and certificate chain (or trusted verified App Store server library), check bundle ID, product ID, environment, transaction ownership, expiry and revocation; associate original transaction ID uniquely to one driver; make writes idempotent and concurrency-safe.
5. Subscribe to and validate **App Store Server Notifications V2** for renewal, cancellation, billing retry, grace period, refund, revoke, expiration, and restore; reconcile periodically with App Store Server API.
6. Model billing provider separately from Stripe. Do not put `apple:...` in `stripe_subscription_id`: existing `hasPaidDriverGold`, `syncBilling`, `openGoldBilling` and `closeGoldBillingForDeletedAccount` call Stripe and would mis-handle such records.
7. Use verified Apple's subscription period end, not `now + 30 days`; verify the seven-day trial exists in App Store Connect rather than promising it unconditionally.
8. Sandbox-test initial purchase, pending approval, Ask to Buy, failed/cancelled purchases, renewal, refunds, restores, expiration and account deletion.

**Apple 4.2 remote-loading behavior is intentionally unchanged.**
