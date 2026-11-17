# Demande prête pour Lovable — validation de la base et des services réels

Aucune des actions ci-dessous n’a été exécutée sur la production depuis cette conversation. Ne pas modifier les prix, le lien de tarification, les montants, commissions ou fonctions de calcul. L’état local est décrit dans `livraison-technique.md`.

## Contrôles à faire sur le projet existant

1. Identifier le bon environnement et confirmer la correspondance avec le site, sans copier ses secrets dans le dépôt ou les échanges.
2. Lire l’état réel des politiques RLS, des autorisations de stockage privé et des fonctions privilégiées. Tester client A / client B / chauffeur A / chauffeur B / administrateur avec des données de test dédiées. Vérifier qu’un rôle ou consentement dans user_metadata ne suffit pas à obtenir un rôle administrateur. Confirmer les méthodes de vérification de session utilisées par les fonctions serveur.
3. Vérifier le bucket privé driver-documents, les permissions d’envoi/lecture, limites de taille et types MIME, ainsi que la durée des URL signées. Vérifier les journaux d’accès et qu’aucun document personnel n’est publiquement accessible.
4. Vérifier les contraintes d’unicité de course active, d’attribution et de références de paiement. Rejouer les notifications uniquement en environnement de test ; vérifier la non-duplication des écritures, y compris en concurrence et après panne. Ne pas modifier les montants calculés.
5. Vérifier l’existence, le calendrier et l’exécution réelle de la purge. Confronter ses résultats à la politique publiée avec un jeu de données de test ; ne pas déclencher une purge de données de production sans scénario spécifique autorisé.
6. Confirmer les sauvegardes, leurs accès et leur rétention ; faire une restauration dans un environnement isolé, jamais par écrasement de la production. Conserver une preuve de test expurgée des données personnelles.
7. Contrôler les URL autorisées de confirmation et récupération de mot de passe, les modèles e-mail et la configuration d’envoi. Tester avec une adresse de recette explicitement fournie, sans utiliser arbitrairement l’adresse du propriétaire ou celle d’un client.
8. Vérifier la configuration des webhooks et environnements de paiement sans révéler leurs clés. Les tests financiers réels doivent être définis séparément avec montant, bénéficiaire, remboursement et autorisation explicites ; ne déclencher aucun mouvement d’argent à partir de cette seule liste.

## Évolutions à réaliser via les mécanismes Lovable

- Réaliser la facturation décrite dans `lovable-facturation.md`, après obtention des identités et règles comptables réelles. Elle ne peut pas être remplacée par une numérotation locale.
- Prévoir un historique persistant et contrôlé des actions sensibles (validation exceptionnelle de documents, suspension, suppression, décisions sur les demandes et émission comptable), sans y journaliser de tokens, PIN, numéros bancaires ou copies inutiles de documents.
- Vérifier la preuve d’acceptation versionnée des conditions : les métadonnées d’inscription actuellement fournies par le navigateur ne constituent pas un journal serveur immuable. Définir le recueil, les versions applicables, l’horodatage serveur, la consultation et l’information/revalidation nécessaires après modification importante.
- Définir des garanties de déduplication et de limitation d’envoi des nouvelles demandes authentifiées si nécessaire. Les protections d’interface et le contrôle avant insertion ne constituent pas une contrainte d’unicité concurrente.
- Confirmer l’organisation de la suppression et les exceptions d’archivage : demande reçue, vérification, décision, exécution et réponse. Ne pas promettre une suppression automatique des pièces dont une conservation légale est nécessaire.
- Prévoir, selon l’analyse de risques, les protections d’administration et l’authentification forte appropriées, sans bloquer arbitrairement les comptes avant une procédure de récupération validée.

## Sortie attendue

Pour chaque contrôle : environnement, date, responsable, résultat, preuve sans données sensibles et anomalie éventuelle. Pour chaque évolution : migration gérée par Lovable, tests d’accès et de concurrence, mécanisme de retour arrière préservant l’historique et documentation mise à jour. Aucun résultat ne doit être coché « conforme » sur la seule existence du code dans le dépôt.
