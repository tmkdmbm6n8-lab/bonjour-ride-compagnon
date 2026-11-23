# Live driver activity and account changes

The shared `DriverActivityProvider` lives above route content. Driver tabs reuse one online status, GPS watcher, active ride, and offer controller. A new mount shows a status check until the server confirms availability; it never renders an actionable GO based on an assumed offline state.

`DriverIncomingOffer` renders ordinary and advance-reservation requests using one full-screen card. Refusal, X, and expiration only dismiss the overlay; the underlying route is not changed. Accepting an ordinary request navigates to the active ride on the dashboard only after the server claim succeeds. Accepting an advance reservation opens the reservations list. The four server dispatch windows and the advance-reservation presentation window are 45 seconds. Ordinary countdowns use the server expiration timestamp, including after tab navigation. Android pushes received or opened in an existing driver tab refresh the shared offer instead of redirecting the driver first.

## Account enforcement

The authenticated account check runs every five seconds while visible and immediately on focus, visibility recovery, reconnection, local mutations and cross-tab invalidation. Own-row Supabase Realtime events accelerate it when the existing database publication permits them; correctness does not depend on that publication. GPS and online-time writes do not trigger full invalidation. Requests are serialized, abort after 15 seconds, and abort on cleanup. Network failures preserve the last confirmed state rather than inventing an offline status or a ban.

Manual suspensions record a signed internal access decision in the existing safety-decision storage. This distinguishes a suspension from pending approval without a schema migration. Unsigned records cannot suspend another user. New online transitions and ride/reservation acceptances validate the current server state; suspended drivers receive no new offers. Driver views display a suspension message and sign out locally on each connected device after the account check. Existing active driver trips remain operable until closure. Driver suspension does not revoke passenger/support access. Existing manual suspensions lacking a signed decision cannot safely be reclassified as bans automatically; a subsequent admin suspension records the decision.

Shared driver data refreshes at most every five seconds, with cost-aware traffic/historical earnings intervals retained. Reservation badges, Gold and user capabilities refresh across tabs. Removed admin/driver permissions are rechecked server-side and reflected in navigation. Gold is no longer restored from another account's unscoped browser cache.

## Published code updates

A build ID is compiled into client and server bundles. The public build check runs every 30 seconds and on foreground/reconnection. Idle pages reload automatically for a new release. Active rides, dialogs/offers, recent interactions, edited forms, payment/auth/contact pages and focused inputs/iframes prevent automatic reload. A notice offers manual refresh; unsaved edits require confirmation. Reloads are rate-limited during mixed-version rollouts. Current installations need to load this implementation once before they can detect future releases. Offline/background clients catch up on return; there is no zero-latency delivery guarantee.

## Validation

Production client/server build succeeds. Tests cover cross-tab invalidation, request coalescing/cleanup, signed access decisions, suspension outside the dashboard, active-trip completion before logout, form/ride-safe deployments, persistent availability, global offer acceptance/refusal/X/expiration, and dispatch deadlines. Protected pricing code is unchanged from the starting commit. The repository's pricing-integrity baseline already differs from its source. Four existing suites (14 failures: currency, geocoding, driver tabs and an expired QR expectation) also fail on the untouched starting commit; this change does not adjust their business rules.
