OSM speed cameras
=================

Manual radar creation is restricted to drivers whose current `drivers.is_priority` flag is true. The server reads this flag before either creating or merging a radar report. Police reporting is unchanged. Both driver screens hide the radar button for other drivers.

The map loads OSM nodes tagged `highway=speed_camera` through the Overpass interpreter. The query is read-only; nothing is imported into or written to the app database or OSM. Cameras are displayed for all authenticated users at zoom 9 and above, within bounded map views of at most one degree in each direction. Move the map to load other locations. Offer thumbnails retain the route preview without loading an additional radar overlay.

The authenticated `/api/maps/speed-cameras` handler queries the visible bounds. The driver road-alert handler also includes OSM cameras around the driver's position so existing approach beeps apply. OSM entries cannot be voted on or deleted through the community report endpoints. Nearby manual and OSM cameras are deduplicated within 60 metres. Coverage and accuracy depend on OpenStreetMap; the data is not a complete or real-time camera inventory.

Requests are debounced in the browser and aligned to a 0.1-degree grid on the server. Successful answers are cached for six hours (96 bounded entries per server process), identical in-flight queries are shared, and at most two requests run simultaneously. Failure triggers a 60-second cooldown, with cached data retained when available. The default endpoint is `https://overpass-api.de/api/interpreter`; `OVERPASS_API_URL` can configure an operator-managed instance on the server. For larger deployments use dedicated Overpass hosting rather than relying on a public instance. No API key or database migration is needed.

Validation: permission, control visibility, response validation, query construction, cache sharing and failure recovery are covered by automated tests. Live requests from the development environment timed out; verify availability from the deployment server before relying on automatic camera coverage.

References: https://wiki.openstreetmap.org/wiki/Tag:highway%3Dspeed_camera and https://wiki.openstreetmap.org/wiki/Overpass_API . Existing map credits cover the OSM data source.
