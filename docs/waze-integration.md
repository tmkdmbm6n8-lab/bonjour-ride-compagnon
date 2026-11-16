Waze integration
================

The basemap remains OpenStreetMap/MapLibre so custom vehicles, GPS following and route overlays remain available. No Waze tiles, logos or icons are used.

`src/lib/vtc-waze.server.js` adapts the unofficial endpoints described by the adjacent `waze-traffic-api-main` Python SDK; its MIT notice is preserved in `waze-sdk-LICENSE`. No Python runtime is required.

Routing tries Waze, Google Routes, OSRM, then the existing approximate estimate. The existing shared 45-second live-route cache remains in use. Search tries Waze, Photon, then Géoplateforme; reverse geocoding retains the existing providers. Waze requests time out after 3.5 seconds; a failure pauses calls for 60 seconds in the current server process.

Only valid returned coordinates, duration and distance are accepted. Returned POLICE, SPEED_CAM/RED_LIGHT_CAM and JAM alerts are rendered along the current live leg, without writing them to the community-alert database. No independent Waze traffic feed is available in the supplied SDK. Traffic delay is unknown rather than invented when the provider supplies no baseline duration. The ETA label identifies Waze only for successful Waze routes.

Vehicle movement is interpolated over 900 ms between received positions. Actual position freshness still depends on the existing driver GPS publishing and client polling. The existing navigation camera follows the GPS position.

Live Waze calls could not be verified from the development environment (network fetch failed). These unofficial endpoints may require additional access or refuse requests; the fallback providers keep the application usable. Run the tests and validate successful live calls from the deployment server before relying on Waze availability.
