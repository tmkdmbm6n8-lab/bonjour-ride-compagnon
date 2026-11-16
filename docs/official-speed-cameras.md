Official fixed cameras in France
===============================

The server bundles 3,309 fixed camera locations from the French Ministry of the Interior dataset:
https://www.data.gouv.fr/datasets/liste-des-radars-fixes-en-france

Source publication: 30 December 2025. Downloaded: 16 November 2026. License: Licence Ouverte / Open Licence 2.0:
https://www.etalab.gouv.fr/licence-ouverte-open-licence/

The snapshot is in `src/data/speed-cameras-fr.json`, imported only by `vtc-driver-cameras.server.js`. It is not a public static asset. Only authenticated drivers may call `/api/maps/speed-cameras`; rider maps do not activate `showRoadAlerts`. The source and speed limit are shown in the camera marker tooltip.

Mainland France, Corsica and any other queried area with official camera records are served from this snapshot immediately. This removes the dependency on Overpass availability for those areas. Outside these areas, the existing Overpass service remains the fallback. The driver proximity feed uses the same source for the existing approach beeps. Manual radar creation remains restricted to priority drivers.

To refresh from the same published resource, run:
`node --use-system-ca scripts/refresh-speed-cameras.mjs`

Check the producer's current publication date and update `publishedAt` in the import script if the resource has been replaced. Commit and redeploy the new snapshot. The script validates row format and coordinates and rejects unexpectedly small files before overwriting the previous dataset. No paid service, additional key, or database migration is required.

These are fixed camera records, not live enforcement reports or a guarantee of exhaustive coverage. Records may be missing, obsolete, or include red-light and average-speed cameras. A speed limit is shown only if supplied in the source. Overpass remains useful as an alternative for other countries; a dedicated instance or licensed commercial dataset would be needed for a larger guaranteed-availability service.
