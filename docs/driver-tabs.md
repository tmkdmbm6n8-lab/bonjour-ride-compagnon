# Onglets chauffeur et sources de transport gratuites

Cette livraison concerne uniquement la demande Découvrir / Revenus / Inbox / Menu et les préférences de conduite.

## Installation

Copier les fichiers dans les chemins indiqués. Lancer la compilation habituelle du projet (`npm run build`) : TanStack découvre automatiquement les nouveaux fichiers de routes. Aucun fichier généré, aucune migration SQL, aucun abonnement ni nouvelle clé API ne sont nécessaires.

## Découvrir

- Aéroport : tableaux publics officiels `https://www.strasbourg.aeroport.fr/app/data.php?temps_reel=arrivee` et `https://www.strasbourg.aeroport.fr/app/data.php?temps_reel=arrivee&histo=1` : les vols à venir et déjà opérés sont réunis sans doublons. Les dates effectivement présentes dans le tableau sont utilisables ; aucune couverture future ou historique complète n'est promise. Une date non publiée est signalée.
- Trains : API gratuite Train Nomade, données SNCF sous ODbL. Horaires prévus de Strasbourg sur la fenêtre de publication de 14 jours ; suivi du jour sur la fenêtre temps réel disponible (environ -30 minutes à +3 heures). Les autocars TER sont exclus.
- Actualisation lorsque l'onglet est ouvert : une minute. Les horaires théoriques ne sont pas présentés comme du temps réel ; un flux périmé est signalé. Les sources et heures de consultation sont affichées.
- Favoris et indicateurs de lecture : stockage local du navigateur, par compte.
- Aucun fournisseur aérien payant n'est appelé.

## Alerte de retour potentiel

La destination de la course doit être dans un rayon de 5 km de SXB, ou à 5 minutes maximum selon un itinéraire routier disponible. Les durées approximatives ne permettent pas de valider le seuil de cinq minutes. La liaison routière utilise la chaîne de routage déjà présente dans le projet et est mise en cache ; aucun nouveau service de routage n'est configuré.

Une arrivée de vol fraîche, non annulée, doit coïncider avec la fin estimée de la course, approche comprise. La fenêtre retenue va de 15 minutes avant à 60 minutes après l'arrivée estimée du chauffeur à proximité de l'aéroport. Le message indique le vol et son heure publiée, sans garantir une réservation ou un revenu. Les courses fictives sont exclues. L'ajout d'une information à une offre ne redémarre pas son compte à rebours.

## Revenus

Les montants viennent des courses réellement terminées, hors tests. La semaine et les jours utilisent Europe/Paris, y compris les changements d'heure. Le temps réellement enregistré en course, approche comprise, est réparti sur les journées traversées. Le temps de connexion et d'attente hors course n'était pas enregistré ; il n'est pas inventé. Les prix, commissions et versements ne sont pas recalculés.

## Inbox et administration

Les discussions clients viennent de l'historique des courses. La discussion reste en lecture seule après la fin d'une course. Les échanges d'assistance utilisent la table existante `contact_messages` et son champ texte pour une conversation structurée. L'identité propriétaire provient de la session vérifiée. Les réponses simultanées sont protégées par une comparaison de la version précédente.

L'écran d'assistance administrateur permet de répondre. Les messages de contact publics restent lisibles et ne peuvent pas usurper le format d'une réponse administrateur. Les règles de conservation existantes restent appliquées : messages de course un an, assistance trois ans. Aucun nouveau stockage SQL ni nouvelle durée de conservation n'est ajouté.

## Navigation

Découvrir ouvre les horaires. Les boutons de préférences en haut à droite et en bas à gauche de la carte ouvrent `/driver/preferences`. Le menu est une seule page défilante ; les boutons conduisent aux fonctionnalités réelles. Aucun statut de fidélité, promotion, revenu ou message fictif n'est présenté.