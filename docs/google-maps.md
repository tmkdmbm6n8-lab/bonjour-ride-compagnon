# Cartes et GPS externe

La carte d’origine utilise MapLibre, OpenFreeMap/OpenStreetMap, les marqueurs de prise en charge, destination et véhicules. La navigation interne Google (vue de guidage, animation, trafic et bandeau vert) est retirée.

Google reste utilisé côté serveur pour Routes API (durée avec trafic, distance et itinéraire) et Geocoding API (suggestions d’adresse et recherche inverse), via le connecteur Lovable existant. Les secrets restent gérés par Lovable ; aucune clé serveur n’est exposée au navigateur. Aucun changement de facturation ou de configuration du connecteur n’est effectué.

Accepter une course ou valider le PIN n’ouvre aucune application GPS. Le bouton « Démarrer le trajet » ouvre le GPS uniquement sur action explicite :

- Aucun GPS enregistré : propose Plans Apple, Google Maps et Waze. Le choix est enregistré avant l’ouverture.
- GPS déjà choisi dans les préférences ou lors d’un trajet précédent : ouvre directement cette application, sans redemander le choix. L’ancien interrupteur de redirection automatique ne force plus le sélecteur.
- Le choix peut être effacé depuis les préférences pour retrouver les trois propositions.

Une éventuelle confirmation d’ouverture affichée par iOS/Safari ou le système reste indépendante du sélecteur StrasDrive et ne peut pas être supprimée par le site.

Le bouton cible la prise en charge avant l’arrivée, puis la destination une fois la course démarrée avec le PIN. Il ne change pas le statut de la course. Les actions Je suis arrivé, PIN et Terminer restent distinctes. L’application GPS choisie reçoit les coordonnées de la destination. Seul le nombre de radars sur le trajet reste affiché dans StrasDrive. Les marqueurs de radar, signalements police et commandes de son associées sont retirés. Les radars ne sont pas ajoutés à l’application GPS externe.

La réservation ne fixe aucune distance maximale : les trajets de plus de 200 km sont autorisés dès lors que le fournisseur renvoie un itinéraire et un devis. Le minimum de 100 m reste en place. Les calculs et la source des prix sont inchangés.
