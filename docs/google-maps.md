# Cartes et GPS externe

La carte d’origine utilise MapLibre, OpenFreeMap/OpenStreetMap, les marqueurs et radars existants. La navigation interne Google (vue de guidage, animation, trafic et bandeau vert) est retirée.

Google reste utilisé côté serveur pour Routes API (durée avec trafic, distance et itinéraire) et Geocoding API (suggestions d’adresse et recherche inverse), via le connecteur Lovable existant. Les secrets restent gérés par Lovable ; aucune clé serveur n’est exposée au navigateur. Aucun changement de facturation ou de configuration du connecteur n’est effectué.

Accepter une course ou valider le PIN n’ouvre aucune application GPS. Le bouton « Démarrer le trajet » ouvre le GPS uniquement sur action explicite :

- Redirection automatique activée : ouvre le GPS préféré enregistré.
- Redirection automatique désactivée : propose Plans Apple, Google Maps et Waze ; choisir une application l’ouvre et enregistre ce choix.

Le bouton cible la prise en charge avant l’arrivée, puis la destination une fois la course démarrée avec le PIN. Il ne change pas le statut de la course. Les actions Je suis arrivé, PIN et Terminer restent distinctes. L’application GPS choisie reçoit les coordonnées de la destination. Les radars restent dans StrasDrive et ne sont pas ajoutés à l’application GPS externe.
