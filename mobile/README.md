# StrasDrive — application mobile native

Migration progressive iOS et Android vers React Native, sans WebView principale. Le site TanStack Start et le conteneur Capacitor existants restent opérationnels pendant la migration.

## Contrat
- Reproduire toutes les interfaces et fonctionnalités client et chauffeur, sans modification visuelle volontaire.
- Le serveur reste autoritaire pour dispatching, tarifs, commissions, paiements, réservations, droits et mutations métier. Aucun secret serveur embarqué.
- Consultation hors ligne des données autorisées déjà téléchargées, stockage chiffré par compte, purge à la déconnexion et contrôle des droits au retour du réseau.
- Synchronisation silencieuse à la reconnexion et au retour au premier plan, sans date affichée, sans écran global de synchronisation. Les actions réseau échouent proprement avec invitation à se reconnecter; aucune mutation financière ou de course rejouée automatiquement.
- Les changements métier compatibles avec le contrat API s'appliquent sans nouvelle compilation mobile.

## Étapes et critères de livraison
1. Inventorier routes, appels API, fonctions serveur, authentification, plugins, ressources et fonctionnalités des deux rôles; établir une matrice de parité.
2. Définir les contrats API mobiles versionnés, conserver les règles serveur existantes et vérifier authentification, autorisations et révocation.
3. Créer le projet React Native indépendant, reproduire navigation, thème et lancement; ajouter stockage sécurisé et couche réseau.
4. Migrer chaque écran et ses fonctionnalités; synchronisation par compte, gestion des erreurs et données hors ligne.
5. Vérifier parité, sécurité, fonctionnement sans réseau, reconnexion, changement de compte, courses en cours, notifications, GPS et paiements sur appareils iOS et Android.
6. Remplacer le conteneur de production uniquement après validation des critères précédents.

Ce document fixe les exigences; il ne constitue pas une application native compilable. Aucun changement de configuration Capacitor ni de logique métier à cette étape.
