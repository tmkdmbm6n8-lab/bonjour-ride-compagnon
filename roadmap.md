# StrasDrive — import fidèle de l’archive
- [x] Importer le code source sans secrets ni fichiers générés ; conserver une copie originale non exécutée.
- [x] Restaurer les écrans et les styles d’origine dans l’aperçu Lovable.
- [x] Traduire les textes en français et afficher les euros, sans conversion des montants.
- [x] Vérifier les pages publiques sur ordinateur et téléphone ; tests de navigation et euros réussis.
- [ ] Vérifier les parcours connectés client, chauffeur et administration — aucun compte confirmé disponible.
- [ ] Finaliser et vérifier les adaptations de courses, permissions, portefeuille et suivi en direct — migration fonctionnelle non terminée.
- [ ] Importer les données et comptes existants — exports absents.
- [ ] Vérifier Stripe et stockage existants — accès sécurisés nécessaires.

# Conformité légale France
- [x] Rémunération chauffeurs ARPE (9 € net/course, 30 € net/h approche comprise, 1 €/km) garantie par les prix passagers, vérifiée en fin de course.
- [x] RGPD : case d'acceptation à l'inscription, export des données, demande de suppression, effacement automatique selon les durées annoncées.
- [x] Mentions légales, CGU et politique de confidentialité alignées sur le fonctionnement réel.
- [ ] Coordonnées réelles de la société (raison sociale, SIREN, TVA, adresse, directeur de publication, n° de centrale de réservation, médiateur) — en attente de l'utilisateur.
- [ ] Indicateurs annuels d'activité et de revenus des chauffeurs à publier (art. L7342-9 Code du travail) — à confirmer avec l'utilisateur.

# Attribution des courses
- [x] Niveau prioritaire par chauffeur, choisi par l'admin.
- [x] Envoi : prioritaires tous ensemble → le plus proche seul quelques secondes → tous ensemble, le premier qui accepte.
- [x] Notification du chauffeur prioritaire : distance jusqu'au client et mention « très rentable / rentable / non rentable », il choisit d'y aller ou non.

# Logo
- [x] Remplacer le logo « K » par un logo « SD » dans le même style (carré noir arrondi, point doré).

# Confort mobile (demande du 14/11)
- [x] Messages du chat plus visibles
- [x] Saisie du code PIN visible au-dessus du clavier
- [x] GPS lancé automatiquement à l'acceptation et à la prise en charge
- [x] Carte : déplacement/zoom uniquement à deux doigts (Voyager et Conduire)
- [x] Client : voir les chauffeurs proches et zoom automatique dessus après l'adresse
- [x] Suggestions d'adresse en temps réel sous le champ
- [x] Son de notification (style Uber, distinct par type)

# Itinéraire en temps réel (demande du 14/11)
- [x] Itinéraire calculé par Google Routes avec trafic en temps réel (OSRM en secours)
- [x] Temps de trajet et heure d’arrivée affichés sur la course (client, chauffeur, offre)
- [x] Plus de ligne droite muette : « durée estimée » affichée, aucun tracé

## Alerte de message bien visible
- [x] Grande alerte « Nouveau message » en haut de l'écran + bouton Discussion mis en évidence (passager et chauffeur)

## Virements chauffeurs hebdomadaires
- [x] Gains chauffeurs conservés sur la plateforme, virement automatique chaque semaine dimanche→lundi minuit (heure de Paris)
- [x] Retrait anticipé avant la date : 0,50 € de frais
- [x] Course en espèces : la commission (5 %) que le chauffeur doit est récupérée automatiquement sur sa prochaine course payée par carte/portefeuille
- [ ] Virement réel vers la banque des chauffeurs — en attente de la connexion d'un compte Stripe (clé secrète)

# Notifications push Android (demande du 16/11)
- [x] Notification push d’offre de course quand l’app Android est en arrière-plan (bannière visible, son)
- [ ] Nouvel APK avec les notifications — en attente du fichier google-services.json de Firebase
- [ ] App iPhone (IPA) — reportée à la demande de l'utilisateur

# Vocaux façon Snapchat (17/11)
- [x] Bouton micro à droite, bulle qui suit le doigt, glisser à gauche = corbeille
- [x] Lecture : bouton play rouge, onde, vitesse 1x/1,5x/2x, durée

# Page course chauffeur (17/11)
- [x] Contenu centré, rien ne déborde à droite
- [x] Textes des onglets du bas visibles sans défiler
