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

- Maps, address search and routing use keyless free services (OpenStreetMap standard tiles via MapLibre, Photon geocoding, OSRM routing) as in the original archive; never add a Google Maps key requirement — the user wants no API key to supply.

- Any fare discount is a single rate constant in `src/lib/vtc-pricing.js` applied inside `calculateFare`; quotes and server-side booking charges share it, so setting it to 0 removes the discount everywhere.
- Driver pay floors (per ride, per hour incl. approach, per km, net of commission) are constants in `src/lib/vtc-pricing.js`, applied in `calculateFare` after any discount and re-checked at completion by `settleDriverEarnings` using `rides.accepted_at`; the passenger price never changes after booking, the platform fee absorbs any top-up.
- Legal pages (`/privacy`, `/terms`, `/mentions-legales`) must describe the app's real data flows and retention; company identifiers live in `src/lib/legal.js`, and retention is enforced by the nightly `purge_expired_personal_data` job, so change both together.
- Ride dispatch rules and profitability labels live in `src/lib/vtc-dispatch.js` (pure, unit-tested); `vtc.server.js` only loads available drivers and applies the returned patch with a phase-guarded update, so concurrent polls and accepts cannot double-assign.
- The brand logo is the inline SVG in `src/components/brand/KovaLogo.jsx`; `public/favicon.svg` is a copy of it and must change with it.
- Mandatory French VTC driver documents (list, validity rules, compliance) live in `src/lib/vtc-documents.js` (pure, unit-tested); files go to the private `driver-documents` bucket under `<user_id>/`, rows in `driver_documents` are written only by the server, admin approval requires every required document approved and going online is blocked by missing, rejected or expired ones, unless the admin confirms "approve anyway", which sets `drivers.documents_override` (admin-only, cleared by suspension or a normal approval). The privacy and terms pages list these documents, so change them together.
- Vehicle classes and which lower classes each class may opt into live in `src/lib/vtc-classes.js` (pure, unit-tested); `drivers.vehicle_class` is admin-only and `drivers.accepts_classes` is written only by the server after sanitizing, dispatch and rider availability both go through `canServe`, and a lower-class ride always pays that ride's own class fare.
- Admin test rides (`rides.is_test`) are offered only to the chosen driver, even offline, never enter normal dispatch, and skip payments, fees, ratings and stats; keeps testing from touching real money.
- Sign-out uses local scope and a request without a session sends the user to `/login?expired=1` (in `archive-fetch.js`); a global sign-out on one device silently broke the driver's phone.
- Admin account deletion goes through the service-role-only `admin_delete_account` SQL function (atomic) plus storage and auth cleanup in `vtc.server.js`; other users keep their payment lines, unlinked from the deleted rides.
