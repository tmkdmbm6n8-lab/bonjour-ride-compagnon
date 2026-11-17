# Un compte, deux espaces

La bascule ne crée ni ne modifie de rôle. Le menu chauffeur propose « Passer en mode Passager » ; le menu du compte passager propose « Espace Chauffeur » uniquement aux comptes disposant de la capacité chauffeur vérifiée par le serveur. Les administrateurs peuvent réserver comme passagers et conservent un lien vers leur administration.

## Comportement

- Le passage vers l’espace passager met le chauffeur hors ligne et efface sa position serveur lorsqu’il n’a pas de course de conduite active. Une course chauffeur attribuée/en cours bloque la bascule et la réservation passager.
- Les réservations passager sont autorisées aux comptes client, chauffeur et administrateur. La carte comme le portefeuille/les espèces passent par les contrôles de conflit. Les calculs de prix et le fournisseur de devis restent inchangés.
- Un chauffeur est toujours exclu du dispatch de sa propre réservation, y compris des offres prioritaires et des notifications associées. Les comptes actuellement en course passager sont exclus du pool de chauffeurs et ne peuvent pas se remettre en ligne ou accepter une offre.
- L’espace ouvert détermine le suivi : `view=rider` utilise rider_id et `view=driver` utilise driver_id après contrôle de capacité. Le choix d’affichage n’élargit jamais les droits. L’historique passager reste celui du passager, même si le compte est chauffeur ou administrateur.
- Le poller ne consulte les offres chauffeur que dans l’espace chauffeur. Il ne superpose pas plusieurs requêtes de polling et ignore les événements d’un poller démonté lors d’une bascule.
- Revenir au cockpit ne remet pas automatiquement le chauffeur en ligne. Une course passager encore active doit être terminée ou annulée avant ce retour.
- Le retour de paiement du portefeuille conserve l’espace passager lorsqu’il est utilisé depuis cet espace, sans changer les montants ou les règles du portefeuille.

Les contrôles serveur existants et les index de courses actives sont conservés ; aucune migration n’a été appliquée. La recette réelle doit notamment tester plusieurs onglets et des demandes concurrentes, car les vérifications applicatives de conflit ne remplacent pas une contrainte transactionnelle croisée entre rider_id et driver_id. La fonction de course suivante préparée séparément reste inactive tant que sa migration Lovable n’est pas réalisée.
