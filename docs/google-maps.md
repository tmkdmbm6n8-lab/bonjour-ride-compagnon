# Cartes et GPS externe

La carte utilise désormais le SDK Google Maps JavaScript, en thème sombre, avec les marqueurs de prise en charge, destination, position et véhicules. MapLibre/OpenFreeMap n’est plus chargé par MapView. Les mentions Google restent visibles dans la partie de carte non couverte par les panneaux.

La carte est chargée avec `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, déjà présente dans le projet. Cette clé publique doit être restreinte aux domaines du site et à Maps JavaScript API dans Google Cloud. La clé serveur `GOOGLE_MAPS_API_KEY` n’est jamais envoyée au navigateur. La variable navigateur doit être disponible pendant le build ; le SDK et la facturation Google Maps JavaScript doivent être actifs sur le projet de la clé.

Google Routes et Geocoding restent côté serveur pour le temps avec trafic, la distance, le tracé et les suggestions d’adresse. Aucune nouvelle requête Directions/Routes n’est lancée par le SDK d’affichage. Aucun calcul de prix ni lien fournisseur n’est modifié. Il n’y a pas de guidage interne : la navigation reste dans le GPS externe choisi.

Accepter une course ou valider le PIN n’ouvre aucune application GPS. Le bouton « Démarrer le trajet » ouvre le GPS uniquement sur action explicite :

- Aucun GPS enregistré : propose Plans Apple, Google Maps et Waze. Le choix est enregistré avant l’ouverture.
- GPS déjà choisi dans les préférences ou lors d’un trajet précédent : ouvre directement cette application, sans redemander le choix. L’ancien interrupteur de redirection automatique ne force plus le sélecteur.
- Le choix peut être effacé depuis les préférences pour retrouver les trois propositions.

Une éventuelle confirmation d’ouverture affichée par iOS/Safari ou le système reste indépendante du sélecteur StrasDrive et ne peut pas être supprimée par le site.

Le bouton cible la prise en charge avant l’arrivée, puis la destination une fois la course démarrée avec le PIN. Il ne change pas le statut de la course. Les actions Je suis arrivé, PIN et Terminer restent distinctes. L’application GPS choisie reçoit les coordonnées de la destination. Seul le nombre de radars sur le trajet reste affiché dans StrasDrive. Les marqueurs de radar, signalements police et commandes de son associées sont retirés. Les radars ne sont pas ajoutés à l’application GPS externe.

La réservation ne fixe aucune distance maximale : les trajets de plus de 200 km sont autorisés dès lors que le fournisseur renvoie un itinéraire et un devis. Le minimum de 100 m reste en place. Les calculs et la source des prix sont inchangés.
