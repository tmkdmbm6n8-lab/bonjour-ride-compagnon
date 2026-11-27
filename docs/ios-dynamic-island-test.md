# Test Dynamic Island — chauffeur Tata uniquement

La fonction est limitée aux courses fictives envoyées au compte `world.poker74@gmail.com`.
Elle ne démarre jamais pour une vraie course. Les notifications classiques restent inchangées.

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
3. Vérifier que le widget déjà testé utilise bien `GenericAttributes` et que sa cible est toujours active.
4. Choisir l’iPhone réel, puis cliquer sur **Run (▶️)**.
5. Si iOS le demande, autoriser les notifications et les activités en direct.

Le démarrage à distance d’une activité exige iOS 17.2 ou plus récent. Le simulateur ne permet pas ce test.

## 2. Publier le serveur après accord explicite

Ne pas publier avant l’accord de l’utilisateur. La publication est nécessaire pour enregistrer les jetons et envoyer/fermer les bulles depuis le serveur. La tâche d’expiration est déjà configurée pour vérifier les offres chaque minute.

## 3. Vérifier apparition et disparition depuis l’écran d’accueil

1. Ouvrir StrasDrive sur l’iPhone avec le compte `world.poker74@gmail.com`, en chauffeur, avec le réseau.
2. Revenir à l’écran d’accueil de l’iPhone sans fermer StrasDrive.
3. Depuis un autre appareil connecté en administrateur, ouvrir **Administration → Envoyer une demande test**.
4. Choisir **Tata**, puis envoyer.
5. La notification classique et la bulle **Course / Nouvelle course** doivent apparaître.
6. Pour tester le refus : rouvrir l’offre et toucher **Refuser**. La bulle doit disparaître.
7. Pour tester l’acceptation : envoyer une nouvelle demande test et l’accepter. Toutes les bulles de cette offre doivent disparaître.
8. Pour tester l’expiration : envoyer une nouvelle demande test sans y toucher et sans rouvrir l’app. La bulle doit disparaître après la fin des 60 secondes, avec au maximum environ une minute supplémentaire pour la vérification planifiée.

Si la bulle n’apparaît pas : vérifier **Réglages iOS → StrasDrive → Activités en direct**, les notifications, l’absence de mode Concentration, puis rouvrir une fois l’espace chauffeur pour renouveler le jeton de démarrage.
