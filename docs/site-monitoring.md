# Supervision administrateur

Page : `/admin/monitoring`, menu « Charge du site ». Endpoint authentifié : `GET /api/admin/monitoring` ; le contrôle de rôle administrateur est exécuté dans `handleVtc` avant les mesures.

Les graphiques montrent des relevés réels depuis l’ouverture de la page, sur une fenêtre de 30 minutes maximum : chauffeurs au statut `is_online`, courses acceptées/arrivées/en cours, demandes en recherche, courses terminées dans les 60 dernières minutes, et durée aller-retour de la requête de supervision depuis le navigateur administrateur. Les comptages utilisent `head: true` et `count: exact`, sans télécharger les profils, positions ou messages. Un cache de dix secondes par instance et le partage d’une requête en cours réduisent les lectures. Le navigateur ne fait pas de requête périodique quand la page est masquée.

Le pourcentage affiché compare uniquement les chauffeurs déclarés en ligne à l’objectif de 500. L’objectif de 10 000 clients est informatif : aucun compteur de clients connectés n’est inventé à partir du nombre de courses. Ces objectifs ne bloquent ni les inscriptions, ni les connexions, ni les réservations.

La charge CPU, la mémoire, les connexions de base de données et la capacité maximale ne sont pas disponibles via les API applicatives actuelles. La page les signale comme non mesurées ; aucun pourcentage global de saturation n’est déduit de la latence ou du nombre de chauffeurs. Pour afficher ces valeurs il faut une intégration serveur aux métriques du fournisseur d’hébergement / de base de données, avec accès en lecture. La capacité opérationnelle se valide par un test de charge.

Un échec de collecte conserve les dernières valeurs avec un avertissement. L’historique des graphiques reste uniquement en mémoire du navigateur et repart à zéro au rechargement ; il ne remplace pas un historique d’observabilité centralisé. Aucun calcul de prix, itinéraire, limite de participants, schéma ou donnée de production n’est modifié.
