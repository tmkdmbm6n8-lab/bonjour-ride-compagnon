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

## Vue inclinée dans le navigateur

La carte demande explicitement `RenderingType.VECTOR`, le thème sombre Google et les gestes d’inclinaison/rotation. Le suivi en conduite utilise une caméra à zoom 18, inclinaison demandée de 60° et cap GPS (ou cap calculé à partir des déplacements si le téléphone n’en fournit pas). La flèche reste orientée relativement au cap de la carte. Google peut limiter l’inclinaison selon le zoom et l’appareil ; un navigateur sans rendu vectoriel affiche un message et conserve le suivi en 2D. Cette vue n’est ni Street View ni une garantie de bâtiments photoréalistes.

Sur le site iPhone/navigateur, le Navigation SDK natif Google n’est pas disponible. Le guidage vocal Google et les instructions virage par virage restent dans l’application Google Maps ouverte par le bouton de navigation. La vue inclinée dans le site ne constitue pas ce guidage.

## Fluidité du suivi

Le curseur de navigation bleu reste monté entre les positions GPS. Sa position et la caméra sont interpolées ensemble sur 850 ms, avec rotation par le chemin angulaire le plus court. Une première position ou un saut supérieur à environ 300 m s’affiche directement plutôt que de simuler un déplacement à travers la ville. Le suivi ne prédit pas la position au-delà de la dernière mesure GPS. Les deux polylignes bleues restent montées et seul leur chemin est actualisé, pour éviter leur recréation à chaque mesure. La précision et la fréquence du GPS du navigateur restent des limites ; cette animation n’est pas le moteur du Navigation SDK Google.

## Trafic et informations de course

La couche Google TrafficLayer s’actualise automatiquement et est détachée au démontage. Le bandeau vert indique l’adresse de prise en charge ou de destination, sans inventer de manœuvre. La barre d’arrivée utilise le trajet restant (`liveLeg`) plutôt que la durée totale de la réservation ; les estimations approximatives sont signalées. Elle reste dans le volet inférieur pour éviter de chevaucher les détails ou les boutons de course. Le passager reste accessible dans les détails, et les boutons d’appel, de messagerie et de feuille de route restent dans le bandeau.
