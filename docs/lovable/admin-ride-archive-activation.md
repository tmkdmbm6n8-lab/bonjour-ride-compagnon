# Fiches admin et archivage : activation à réaliser avec Lovable

## État réel

L’onglet admin Courses possède un filtre de jour de réservation (heure de Paris), une fiche par course et des coordonnées complètes réservées aux administrateurs. La fiche lit les données actuelles et les archives de signalement signées encore valides. Elle peut reconstituer un bulletin de réservation, clairement marqué comme tel, mais ne le présente pas comme l’original historique. Les demandes de facture existantes ne sont pas des factures émises.

Aucun archivage immuable décennal n’est activé par cette modification. Les suppressions existantes restent en place : messages à la fin du trajet sauf signalement conservé 14 jours, précision des adresses 3 ans, informations comptables 10 ans. Les données déjà supprimées ne sont pas récupérables. La base ne contient qu’un nom déclaré unique, pas deux champs prénom/nom distincts : ne pas inventer une séparation.

## Demande fonctionnelle du propriétaire

Conserver des dossiers de courses consultables par l’administration, accessibles par date, avec réservation, participants, coordonnées, adresses, pièces comptables et échanges. Avant de conserver des messages, vocaux, images ou positions pendant 10 ans, documenter la finalité et la base légale spécifiques et définir une durée proportionnée ; une durée comptable ne s’étend pas automatiquement à toute conversation ou donnée de localisation. Les factures et pièces comptables applicables peuvent relever des 10 ans. Ne pas annoncer une validation juridique obtenue.

## Travail Lovable requis (AGENTS.md réserve les migrations à Lovable)

1. Concevoir les tables privées versionnées d’archive de course et de pièces, accès service_role uniquement, aucune mutation client. Séparer les données comptables, la réservation, les contacts et la discussion avec expirations adaptées ; ajouter un index date de réservation + identifiant. Si une archive de discussion plus longue est retenue, faire approuver/documenter sa finalité avant activation.
2. Produire un instantané serveur à la réservation et à chaque étape pertinente, puis sceller la version finale de façon transactionnelle et idempotente lors de la clôture, AVANT toute purge de messages/fichiers. Capturer les noms/prénoms déclarés si réellement collectés, téléphones complets, adresses, opérateur, véhicule, documents de réservation, prix et paiement déjà enregistrés, statuts et horodatages ; ne pas recalculer un prix ou modifier la commission. Distinguer les données inconnues des champs effacés légalement. Ne pas créer des noms/prénoms en découpant arbitrairement un nom libre.
3. Conserver les pièces dans un stockage privé, rattacher chaque pièce à une course avec empreinte cryptographique/version. Une URL signée temporaire n’est pas une archive : copier les octets avant suppression du fichier source, ou employer des références retenues avec un nettoyage qui respecte les durées validées. Aucune URL publique ou secret dans un export.
4. Enregistrer les originaux des factures réellement émises par le bon émetteur (identifiant fiscal, numérotation, date, lignes, TVA/statut fiscal et empreinte) et leurs corrections/avoirs sans remplacer les originaux. La fonction actuelle de demande de facture ne doit pas fabriquer ces documents. Préserver les montants existants et le lien fournisseur.
5. Mettre en place les RPC service_role pour lire une archive complète et ses pièces, enregistrer toute consultation/export admin dans un journal d’accès, et empêcher les modifications après scellement. Relier `/api/admin/rides/:id/record` à cette archive lorsqu’elle existe et identifier sa source/sa version ; conserver le fallback courant pour les anciennes courses sans archive, sans prétendre les avoir archivées rétroactivement.
6. Prévoir la recherche de la même date de Paris dans les courses courantes et archives, la pagination stable et les contrôles d’accès admin sur listes, détails et chaque fichier.
7. Modifier ENSEMBLE les tâches de purge, leurs fonctions SQL, la rétention des pièces, l’export des données, les suppressions de compte, les Conditions/Confidentialité et les notices de discussion. Une suppression de compte ne doit pas détruire une pièce comptable légalement conservée, ni maintenir sans base des données au-delà de leur durée. Définir le début des durées, le gel pour contentieux, la levée du gel et l’effacement effectif, y compris fichiers et sauvegardes.
8. Contrôler les tâches planifiées réellement installées, les erreurs/reprises d’archivage, les sauvegardes et la restauration. Si l’écriture d’archive échoue, ne pas supprimer prématurément les pièces promises : reprise durable, alerte et rapprochement. Une expiration se calcule en années civiles si la règle est décennale, pas en secondes approximatives.

## Recette

- Un chauffeur et un client peuvent changer nom/téléphone après la course sans modifier l’instantané historique ; l’écran indique la source historique.
- Plusieurs clôtures concurrentes ne créent ni double archive ni double paiement ; le signalement/clôture ne perd aucun message.
- Les liens et fichiers restent accessibles uniquement à un admin autorisé, même en devinant une autre référence. Les archives chat expirées/signatures invalides sont refusées.
- Tous les fichiers conservés sont encore lisibles après nettoyage du stockage de discussion ; les fichiers expirés et leurs copies sont réellement purgés.
- Minuit Paris, 23 h au changement d’heure de mars et 25 h en octobre : pas de course du jour voisin.
- Les anciennes conversations déjà purgées et factures non émises restent signalées indisponibles, sans contenu inventé.
- `npm run check:pricing` reste vert, sans modifier le baseline.

## Mise en œuvre (2026-11-18)

Installé : dossier scellé à la clôture (terminée/annulée, hors test), comptable 10 ans civils avec empreinte, coordonnées/adresses/réservation 3 ans, discussions non archivées (14 jours sur signalement inchangé), journal de consultation, fiche admin raccordée. Pas d'archive rétroactive. Restent à faire : factures émises réelles, copie des fichiers, liste par date incluant les courses supprimées, gel contentieux via interface. Vérification en conditions réelles d'une clôture non encore effectuée.

## Corrections après revue (version 6f7ccda)

- Une archive scellée est désormais la seule source des champs historiques de la fiche (prix, paiement, statuts, adresses, coordonnées, véhicule, bulletin). Les valeurs actuelles qui diffèrent sont affichées à part, hors empreinte.
- Coordonnées/réservation effacées : aucune relecture des profils, véhicules ou documents actuels ; le bulletin est indisponible.
- Nouveaux dossiers : l’exploitant et les numéros SIREN/REVTC approuvés sont figés à la clôture. Les dossiers plus anciens sans ces numéros sont signalés « figé partiellement ».
- Verrou renforcé : durée personnelle non prolongeable, effacement irréversible, date de réservation figée.
- Liste admin unifiée (RPC service_role `admin_ride_index`, contrôle admin) : courses actuelles + archives sans course, dédupliquées, ordre stable date puis identifiant, filtre jour de Paris.
- Vérification en base (transaction annulée, aucune donnée gardée) : scellement à la clôture, empreinte valide, refus non-admin, journal de consultation, refus de modification, effacement à 3 ans par la purge, archive toujours listée après suppression de la course.
- Restent hors périmètre : factures émises, copie des messages/fichiers, archives rétroactives, gel de litige depuis l’écran admin.
