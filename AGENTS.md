<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Preserve imported UI modules and their CSS while adapting framework boundaries to TanStack file routes; this avoids replacing the source experience.
- Keep a non-executed source archive under `original-source/` for capabilities requiring incompatible runtimes; track every remaining port in the migration ledger.

- Map display uses MapLibre with OpenFreeMap/OpenStreetMap without radar/police overlays. Address lookup and traffic-aware Google Routes remain server-side through the managed Google Maps connector. Guidance is external only: never launch GPS on acceptance or PIN validation; only the Démarrer le trajet button may open the selected GPS app.
- The live leg (driver → pickup/destination) is computed server-side from `drivers.location` and cached in `rides.live_route` for 45 s, shared by rider and driver; keeps billed routing calls to about one per minute per active ride.

- Any fare discount is a single rate constant in `src/lib/vtc-pricing.js` applied inside `calculateFare`; quotes and server-side booking charges share it, so setting it to 0 removes the discount everywhere.
- Driver pay floors (per ride, per hour incl. approach, per km, net of commission) are constants in `src/lib/vtc-pricing.js`, applied only in `calculateFare` at booking; `settleDriverEarnings` just records real activity time, so neither the passenger price nor the platform commission changes after booking.
- Legal pages (`/privacy`, `/terms`, `/mentions-legales`) must describe the app's real data flows and retention; company identifiers live in `src/lib/legal.js`, and retention is enforced by the nightly `purge_expired_personal_data` job, so change both together.
- Ride dispatch rules, the pickup-zone check, the fair-share throttle and profitability labels live in `src/lib/vtc-dispatch.js` (pure, unit-tested); `vtc.server.js` only loads available drivers and applies the returned patch with a phase-guarded update, so accepts cannot double-assign.
- The driver tabs' look (Accueil, Découvrir, Revenus, Inbox, Menu) is the `--drv-*` token block at the end of `src/styles.css`, which overrides the imported reference layer above it; keep it last so it wins.
- The brand logo is the inline SVG in `src/components/brand/KovaLogo.jsx`; `public/favicon.svg` is a copy of it and must change with it.
- Mandatory French VTC driver documents (list, validity rules, compliance) live in `src/lib/vtc-documents.js` (pure, unit-tested); files go to the private `driver-documents` bucket under `<user_id>/`, rows in `driver_documents` are written only by the server, admin approval requires every required document approved and going online is blocked by missing, rejected or expired ones, unless the admin confirms "approve anyway", which sets `drivers.documents_override` (admin-only, cleared by suspension or a normal approval). The privacy and terms pages list these documents, so change them together.
- Vehicle classes and which lower classes each class may opt into live in `src/lib/vtc-classes.js` (pure, unit-tested); `drivers.vehicle_class` is admin-only and `drivers.accepts_classes` is written only by the server after sanitizing, dispatch and rider availability both go through `canServe`, and a lower-class ride always pays that ride's own class fare.
- Admin test rides (`rides.is_test`) are offered only to the chosen driver, even offline, never enter normal dispatch, and skip payments, fees, ratings and stats; keeps testing from touching real money.
- Test-offer expiry shares the broadcast countdown in `vtc-dispatch.js`; this keeps real and fictitious one-minute replacement timers aligned.
- Sign-out uses local scope and a request without a session sends the user to `/login?expired=1` (in `archive-fetch.js`); a global sign-out on one device silently broke the driver's phone.
- Admin account deletion goes through the service-role-only `admin_delete_account` SQL function (atomic) plus storage and auth cleanup in `vtc.server.js`; other users keep their payment lines, unlinked from the deleted rides.
- Ride payment method lives in `rides.payment.method` (`wallet`|`cash`|`card`), sanitized by `paymentMethodOf` in `src/lib/vtc-pricing.js`; `settle_ride` debits only the driver's platform share for cash rides, so the rider wallet is never touched and the driver's negative-balance limit still applies.
- `MapView.jsx` uses the MapLibre worker URL import; preserve the original marker styles, map source attribution and route radar counts.
- Driver navigation (Google Maps/Waze deep links) lives in `src/lib/navigation.js`; notification melodies are synthesized in `src/lib/sounds.js` (no audio files), one distinct melody per event.
- Inputs that open the phone keyboard (address search, PIN, chat) position themselves with `useVisualViewport`; fixed/portal positioning alone drifts when iOS scrolls the page.
- Driver payout rules (weekly Paris-Monday-midnight schedule, early-withdrawal fee, minimum) live in `src/lib/vtc-payouts.js` (pure, unit-tested); wallet debits go only through the service-role `create_payout`/`finish_payout` SQL functions (a failed transfer re-credits the wallet), and `/api/public/jobs/weekly-payouts` is scheduled Sunday 22:00 and 23:00 UTC but pays only inside `isPayoutWindow`, idempotent per driver per week; this keeps DST changes from double-paying or skipping a week.
- Driver trip preferences (accept cash, minimum rider rating, minimum net €/km incl. approach) live in `src/lib/vtc-trip-prefs.js` (pure, unit-tested), stored in `drivers.trip_prefs` written only by the server after sanitizing, and filtered inside `availableFor` in `vtc-dispatch.js`; the rider's average is snapshotted into `rides.rider_rating` at booking, so dispatch never needs extra queries.
- Card payments (wallet top-up with a free amount, ride paid by card at booking) live in `src/lib/vtc-checkout.server.js` with pure rules in `src/lib/vtc-checkout.js` (unit-tested); they use Stripe Embedded Checkout through `createStripeClient` in `src/lib/stripe.server.ts`, and every paid session is credited to the wallet once via `wallet_entry` keyed on the session id. A card ride holds its quoted fare in `card_bookings`, is created only after payment with that exact fare and `payment.method = 'card'`, and settles from the wallet like a wallet ride; one settlement path.
- Police/radar reports live in `road_alerts` + `road_alert_votes` (service-role only, reached through `roadAlerts` in `vtc.server.js`); thresholds and the 100 m accelerating beep are pure rules in `src/lib/vtc-road-alerts.js` (unit-tested), so reports are shared between drivers; radars are fixed until an admin deletes them and police expiry is the same TTL in the rules and the nightly purge.
- The basemap uses OpenFreeMap vector tiles and public/map-dark.json. Keep map attribution visible. There is no in-app turn-by-turn navigation.
- Manual radar reports require drivers.is_priority, verified by requireRadarReporter before any insert or merge. OSM highway=speed_camera nodes are read through vtc-speed-cameras.server.js (bounded, six-hour cache), read without database writes for route radar counts.
- Radar/police map markers and reporting/audio controls are removed from the driver UI; keep the route radar count. /api/maps/speed-cameras verifies the authenticated driver role. The official French camera snapshot (src/data/speed-cameras-fr.json, Licence Ouverte 2.0) is server-only and primary in France; Overpass is the fallback elsewhere. Refresh with scripts/refresh-speed-cameras.mjs.
- Android (Capacitor) loads the published URL via `server.url`; `capacitor-shell/` is only redirect + offline page, since TanStack Start has no static index.html.
- Ride-offer pushes go out from `assignOffer` only when its guarded update wins, to `newlyOfferedDriverIds` (`vtc-push.js`); tokens in service-role `push_tokens`. Each dispatch step notifies once, no send log.

- User instruction (2026-11-17): never alter the pricing calculations, amounts, remuneration parameters, or the external link supplying prices. Preserve the quote/estimate integrations. Security and compliance work must not recalculate or adjust fares.
- Run `npm run check:pricing` after any future change. Do not refresh the protected pricing baseline to conceal a change; obtain an explicit new user instruction before any alteration of the protected calculation/link.

- Rider driver reports use authenticated `/api/rides/:id/report` and existing `contact_messages` safety storage. Server-signed messages prevent public contact messages counting toward suspension. Three distinct reported rides set only `drivers.is_approved/is_online/documents_override` false. The driver dashboard shows the suspension and support/passenger access; an active ride can still be completed. Reapproval remains an admin action. Never restrict the passenger profile or recalculate fares.

- Ride chat attachments use the private `ride-chat-private` bucket, created lazily via the storage API (no database schema change). Text/voice/image/location messages are appended with JSON compare-and-set so concurrent sends cannot overwrite each other. Retention markers are hidden from participants. A report before closure preserves an admin-only signed archive in `contact_messages` for 14 days from the first report; closing always clears `rides.messages`. Archive expiry removes files before deleting the archive, with retryable file cleanup records. `/api/public/jobs/chat-retention` is authenticated with the existing Lovable cron secret and must be scheduled in Lovable; never claim a production schedule is active without checking it.

- Manual withdrawal requests use `withdrawals.server.js` and the service-role-only RPC contract in `docs/lovable/withdrawal-approval-activation.md`. This workflow is prepared, not production-activated: never bypass the version gate. A request must not debit the wallet; only atomic admin approval may create its linked payout once. Retain the existing 0.50 € withdrawal fee, included within the requested total; minimum requested debit 10 €. Keep pending requests out of the weekly automatic payout transaction. Stripe retries must reuse the same payout idempotency key and ambiguous outcomes must remain in processing. Activation requires Lovable-managed schema/RPCs, durable notification outbox, cron, verified e-mail sender and admin device push registration. Existing native push supports Android; do not claim browser/iPhone background push is active.

- Driver rating detail is `/api/drivers/me/ratings`, projected by `driver-rating-summary.js`: no passenger identities, contacts, ride identifiers or precise dates. Only the server-read drivers.is_priority may unlock negative comments; ordinary drivers receive only 4/5-star comments. Histograms include all valid stars. Preserve the 12-hour publication delay and maximum 500 rated completed, non-test rides. The Earnings day defaults to Paris today on mount and rolls over at midnight; historical selection uses chart days only.

- Normal drivers unlock detailed rating breakdown/comments at 50 eligible published ratings. Below 50, the server returns only count, threshold, locked and priority=false; never send hidden details to the client. Server-verified priority drivers bypass this threshold, including at zero ratings.

- Rating-star fill is count/50 from bottom to top. The genuine celebration is claimed once per account via POST `/api/drivers/me/ratings-unlock`, rechecking published valid ratings server-side and CAS-updating only stats.ratingUnlockSeenAt while preserving other stats. Priority drivers bypass it. The 25-tap easter egg is client-only, resets on modal close, and may reveal only an explicitly labelled empty preview while real details are locked. Never let demo actions call the claim endpoint or alter counts/priority/unlock state. Respect reduced-motion settings.

- Passenger and driver profile ratings must come from completed non-test rides for their own owner column and incoming rating field (`rider_id`/`byDriver` versus `driver_id`/`byRider`), through account-ratings.server.js; never reuse profiles.rating as a shared role rating. Unrated profiles display 0 reviews. Driver Inbox includes administration only. Swipe removal is an owned, compare-and-set hiddenThroughMessageId marker in the existing support thread, not destruction of the admin record. A new message reveals the thread again. Always confirm before hiding and reject stale confirmations if another message arrived.

- Driver profile overview is opened from the Menu hero via `/api/drivers/me/achievements`. Badge tiers are 50/100/500/1000/5000/10000/50000 incoming five-star ratings, counted over all completed non-test driver rides (not the 500-rating display window), published after 12 hours. No passenger-mode rating contributes. SVG badge artwork lives in DriverBadge.jsx. Driver account navigation resets scroll to the heading; Menu vehicle link deliberately has no anchor. Waybill must remain a centered keyboard-safe portal modal. Preferences uses the shared dark driver palette and a close link to Menu; preserve every trip-pref and GPS behavior.

- Driver Preferences has its own three-section StrasDrive layout (Services/Criteria/GPS), not the old ride-hailing tile/switch layout. Preserve existing server preference keys, permitted option constants and navigation storage behavior. Vehicle/Documents, driver Wallet and Preferences share DriverPageClose to /driver/menu; WalletPanel accepts an optional headingAction so the passenger layout stays unchanged.

- Every X used to close/return from an app page, modal, sheet, chat or alert uses ui/CloseControl.jsx and .sd-close-control (same 44px circle as DriverPageClose). Preserve each original destination/callback, disabled state and Radix asChild/ref behavior. Do not alter recording cancellation/delete controls or course-cancellation commands when harmonizing navigation. Inbox trash is not rendered until an intentional left swipe reveals it; ordinary taps and vertical scroll must never reveal the red action.

- Admin-driver Inbox conversation uses Modal fullScreen inside the visual viewport: header and composer are fixed in the flex layout, only history scrolls. Compose uses VTC subject choices and an explicit Other field. Modal body scroll locking must not rerun when callback identities or messages change. Profile overview displays only the highest earned badge and next unearned target, with an empty current slot before the first award; all earned tiers remain stored/calculated.
