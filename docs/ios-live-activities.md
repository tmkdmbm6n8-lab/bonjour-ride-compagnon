# Activités en direct iPhone : préparation

État : **non activé**. Le dépôt ne contient pas de projet iOS, d’extension WidgetKit, de connexion APNs pour les activités en direct ou de pont Capacitor iOS. Les fichiers Swift dans `native/ios/LiveActivities/` sont des sources de départ : ils ne sont inclus dans aucune application et n’ont pas été compilés avec Xcode. Le module `src/lib/live-activity.js` prépare et teste uniquement les données ; il n’est pas encore branché à l’application.

## Contenu prévu

- Client : approche du chauffeur, chauffeur arrivé ou estimation pour la destination. Une estimation absente ou correspondant à une autre étape est affichée comme indisponible.
- Chauffeur : proposition de course avec estimation jusqu’à la prise en charge, durée du trajet et gain chauffeur annoncé. L’offre doit disparaître à son échéance ou lorsqu’elle est acceptée, retirée ou perdue.
- Aucune adresse, identité, numéro, message ou code PIN dans le contenu affiché sur l’écran verrouillé. La référence de course est une donnée technique et ne doit pas être affichée.

## Travail nécessaire avant activation

1. Créer le projet Capacitor iOS avec la version compatible du projet, le compiler sous macOS avec Xcode, puis créer une extension Widget avec Live Activities. Ajouter `RideActivityAttributes.swift` aux deux cibles et `RideLiveActivityWidget.swift` à la cible Widget ; ajouter le point d’entrée `WidgetBundle`, les capacités, la configuration `NSSupportsLiveActivities` et les identifiants Apple appropriés.
2. Construire et tester le pont natif : vérifier la disponibilité d’ActivityKit et l’autorisation système, créer/mettre à jour une activité par course, terminer l’ancienne activité au changement de compte, à la déconnexion, à l’expiration ou à la fin de la course ; assurer une reprise sans doublon après fermeture de l’application. Un toucher doit ouvrir la bonne page via une URL/deep link configuré et validé côté application. L’activité ne doit jamais accepter une course ni lancer un GPS automatiquement.
3. Brancher le client aux états de course et à l’itinéraire partagé, et le chauffeur aux offres réellement attribuées à son compte. Les données doivent être vérifiées côté serveur ; une offre expirée ne doit jamais être présentée comme acceptée ni rester visible comme disponible. Gérer le renouvellement des estimations, leur indisponibilité et la concurrence entre plusieurs téléphones.
4. Pour afficher une nouvelle offre lorsque l’application est fermée, préparer le canal Apple Push Notification service des Live Activities : identité Apple Developer, certificats/clés conservés dans des secrets, enregistrement privé et révocation des jetons, vérification du compte et de l’appareil, livraison idempotente, échéance courte et fin des activités après acceptation ou expiration. Les notifications d’offres Android/FCM existantes ne réalisent pas cette fonction. Les activités lancées à distance dépendent de la version iOS et de la disponibilité des jetons ; prévoir un comportement de repli sans promettre une livraison systématique.
5. Tester sur de vrais iPhone compatibles et sur les versions iOS prises en charge : écran verrouillé et Dynamic Island, hors ligne, refus d’autorisation, fermeture/réouverture, changement de compte, offre expirée ou attribuée ailleurs, absence d’estimation, suspension et fin de course. Vérifier l’accessibilité et la politique de confidentialité. Apple contrôle la disponibilité de l’affichage et de la livraison.

Ne pas présenter ce socle comme une fonctionnalité publiée : il manque le projet natif, la configuration Apple, le pont, les notifications et les tests sur appareil. Une nouvelle version iOS doit ensuite être construite et distribuée.
