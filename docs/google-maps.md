# Cartographie Google Maps

La carte de l’application utilise Maps JavaScript API. Les itinéraires et durées avec trafic utilisent Routes API ; la recherche et la conversion des coordonnées en adresse utilisent Geocoding API. Les radars conservent le service existant : source officielle française, OpenStreetMap/Overpass en secours, signalements des chauffeurs et permissions chauffeur inchangées.

## Configuration dans Lovable

- Le projet possède déjà `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, utilisée en priorité. `VITE_GOOGLE_MAPS_API_KEY` reste une alternative. Cette clé navigateur est publique par conception : la restreindre aux référents HTTP des domaines de production et de prévisualisation, et à **Maps JavaScript API** uniquement. Ne jamais utiliser la clé du connecteur serveur à sa place. Un nouveau build est nécessaire après ajout.
- Le connecteur Google Maps géré côté serveur utilise déjà `LOVABLE_API_KEY` et `GOOGLE_MAPS_API_KEY`. Vérifier dans Lovable qu’il autorise Routes API (`routes/directions/v2:computeRoutes`) et Geocoding API (`maps/api/geocode/json`). Ne jamais ajouter ces secrets au navigateur ni les committer.
- Activer les API nécessaires et la facturation Google Maps Platform. Vérifier les quotas dans le compte Google concerné.

Sans clé navigateur, la carte affiche une erreur explicite et un bouton Réessayer. Sans connecteur serveur, la recherche d’adresse signale une configuration manquante. En cas d’échec de Routes, l’estimation existante est étiquetée approximative et ne dessine aucun tracé ; aucun appel OSRM n’est effectué.

## Navigation

La carte interne conserve le tracé, les positions en direct, le suivi et les radars. Le bouton de navigation ouvre l’application Google Maps (ou Waze si le chauffeur l’a choisie), comme auparavant. Cela n’intègre pas le Navigation SDK natif et ne fournit pas de guidage vocal Google à l’intérieur de la page web.

## Vérification avant mise en ligne

Avec la configuration activée, vérifier sur le domaine autorisé : chargement de chaque carte (chauffeur, passager, administration, aperçu d’une course), recherche d’adresse et géolocalisation inverse, calcul avec trafic, suivi de course, radars réservés aux chauffeurs et attribution Google visible. Les tests locaux ne valident pas les autorisations, quotas ou la facturation des API réelles.
