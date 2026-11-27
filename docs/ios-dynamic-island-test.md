# Dynamic Island — vraies offres chauffeur

La fonction accepte maintenant les offres réelles des chauffeurs sélectionnés par l’attribution existante. Elle ne change ni l’attribution ni les tarifs. Les tests administrateur restent disponibles.

## Ce qui change

- Un seul signalement par offre et par iPhone associé : l’alerte de démarrage de l’activité remplace la bannière classique sur cet appareil seulement, si Apple accepte le démarrage. Apple exige cette alerte ; la supprimer, comme précédemment suggéré, serait incorrect.
- Les autres appareils, Android, les anciens iPhone et les appareils sans activité compatible enregistrée gardent leur notification classique. Un refus Apple du démarrage conserve aussi cette notification.
- Un iPhone compatible avec les activités en direct mais sans Dynamic Island peut afficher l’activité sur l’écran verrouillé, et une bannière de démarrage ; il n’a pas de bulle en haut.
- Les offres sont fermées au refus, à l’acceptation et à l’expiration. Quitter l’app ne doit pas fermer une offre encore valable : la fermeture vient de la fin de l’offre.
- Le démarrage demande désormais le jeton de mise à jour sur iOS 18+, et l’application observe ce jeton dès son lancement natif, même sans écran web chargé.
- Les anciennes activités de démonstration et les offres expirées sont nettoyées à l’ouverture. Les offres ne sont plus créées par l’ancien module local.

Une acceptation Apple n’est pas une preuve de livraison sur le téléphone. Les limites iOS, le réseau et les autorisations peuvent empêcher l’affichage. Le test réel ci-dessous reste indispensable.

## 1. Synchroniser l’application iPhone (obligatoire une fois)

Sur le Mac, dans le dossier du projet :

```bash
git pull
npm install
npx cap sync ios
npx cap open ios
```

Dans Xcode :

1. Sélectionner le projet **App**, puis la cible principale **App**.
2. Dans **Signing & Capabilities**, vérifier **Push Notifications** et **Live Activities**.
3. Vérifier que le paquet **CapacitorLiveActivity** est présent après synchronisation, et que le module `LiveActivityPlugin` est accessible à la cible principale. Le nouvel observateur dans `AppDelegate.swift` doit être conservé si le Mac possède ses propres modifications.
4. Dans la cible du widget, ouvrir le fichier fourni par l’utilisateur contenant `struct StrasDriveLiveActivityLiveActivity: Widget`. Remplacer tout son contenu par celui de `native/ios/LiveActivities/StrasDriveOfferWidget.swift`. Le remplacement conserve ce même nom : ne pas modifier le `WidgetBundle` existant. Conserver intact le fichier séparé définissant `GenericAttributes` (avec `id`, `staticValues`, `ContentState.values`). Ne pas ajouter une deuxième présentation pour ce même type.
5. Choisir l’iPhone réel, puis cliquer sur **Run (▶️)**.
6. Si iOS le demande, autoriser les notifications et les activités en direct.

Le fichier du widget installé a été fourni le 27 novembre : sa vue compacte contient littéralement `Text("Course")` et ses adresses utilisent des valeurs de secours absentes du message serveur. Le remplacement affiche le gain envoyé et le compte à rebours, sans fausses adresses. Le serveur ne peut pas remplacer les textes codés en dur dans l’application installée. La source Swift n’a pas pu être compilée dans Xcode depuis l’environnement Lovable ; Run sur le Mac et la vérification sur l’iPhone restent nécessaires. Le compte à rebours ne ferme pas lui-même l’activité : cette fermeture dépend toujours de l’ordre Apple et du jeton de mise à jour.

Le démarrage à distance d’une activité exige iOS 17.2 ou plus récent. Le simulateur ne permet pas ce test.

## 2. Publier le serveur après accord explicite

Ne pas publier avant l’accord de l’utilisateur. Cette correction n’a pas été publiée automatiquement. La tâche d’expiration a été vérifiée active chaque minute le 27 novembre ; elle appelle `/api/public/jobs/live-activity-expiry`. Ouvrir une fois l’espace chauffeur après la mise à jour et la publication pour réassocier cet iPhone : les anciennes associations non corrélées gardent le secours classique, sans démarrage supplémentaire.

## 3. Vérifier apparition et disparition depuis l’écran d’accueil

1. Ouvrir StrasDrive sur l’iPhone avec le compte `world.poker74@gmail.com`, en chauffeur, avec le réseau.
2. Revenir à l’écran d’accueil de l’iPhone sans fermer StrasDrive.
3. Depuis un autre appareil connecté en administrateur, ouvrir **Administration → Envoyer une demande test**.
4. Choisir **Tata**, puis envoyer.
5. Une seule alerte doit apparaître sur l’iPhone, avec la bulle affichant le gain, par exemple **12,40 €**, si le widget actualisé est installé.
6. Pour tester le refus : rouvrir l’offre et toucher **Refuser**. La bulle doit disparaître.
7. Pour tester l’acceptation : envoyer une nouvelle demande test et l’accepter. Toutes les bulles de cette offre doivent disparaître.
8. Pour tester l’expiration : envoyer une nouvelle demande test sans y toucher et sans rouvrir l’app. La bulle doit disparaître après la fin des 60 secondes, avec au maximum environ une minute supplémentaire pour la vérification planifiée.

Si la bulle n’apparaît pas : vérifier **Réglages iOS → StrasDrive → Activités en direct**, les notifications, l’absence de mode Concentration, puis rouvrir une fois l’espace chauffeur pour renouveler le jeton de démarrage.

Après les tests fictifs réussis, vérifier une offre réelle autorisée, puis refaire le contrôle avec les activités désactivées et sur un téléphone sans Dynamic Island. Confirmer une seule alerte, l’ouverture de la bonne offre, et la fermeture sans rouvrir l’application. Ces vérifications iPhone ne peuvent pas être remplacées par les tests automatisés.
