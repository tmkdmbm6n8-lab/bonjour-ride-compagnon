# Fonctions VTC — état de la livraison

Cette liste distingue les ajouts réalisés des fonctions préexistantes. Elle décrit le code local, sans attester une conformité réglementaire ou un fonctionnement des services de production.

## Ajouts de cette demande

1. Récupération du mot de passe par e-mail (`/recover-account`, lien sur la connexion), via Supabase Auth existant. Le compte doit suivre le lien reçu pour saisir et confirmer le nouveau mot de passe ; déconnexion locale après modification.
2. Renvoi de l’e-mail de confirmation depuis la même page. Message neutre concernant l’existence d’un compte et délai de 60 secondes entre demandes dans l’interface ; limites d’envoi réelles gérées par Supabase.
3. Reçu de course téléchargeable en HTML et imprimable depuis le navigateur, dans le détail de l’historique. Disponible pour les courses terminées et les annulations facturées, jamais pour les tests. Il n’est pas présenté comme une facture fiscale ni comme une preuve d’encaissement en espèces.
4. Réclamation et question de paiement depuis une course passée, avec référence préremplie dans le formulaire Contact existant. Le même canal permet de signaler un objet oublié.
5. Accès Sécurité et assistance pour une course active, côté passager et chauffeur (dans Détails), ainsi que dans l’historique.
6. Appel volontaire du 112 et lien SMS 114. Aucun appel ni signalement automatique aux secours.
7. Partage volontaire du résumé du trajet par le partage du téléphone, sinon presse-papiers ou texte à copier. Contient la référence, les adresses, le nom du chauffeur et l’immatriculation disponibles ; aucun PIN, téléphone personnel ou accès public en direct.
8. Signalement de sécurité avec référence de course via Contact, transmis au canal existant d’administration. Ce formulaire ne remplace pas les secours et ne promet pas de surveillance en temps réel.
9. Panneau administratif de préparation à l’ouverture : reporté à la demande du propriétaire, retiré de l’interface locale.
10. Information de confidentialité sur le partage volontaire du résumé.

## Fonctions déjà présentes, conservées

- Inscription client/chauffeur, connexion, vérification e-mail, rôles et accès serveur.
- Recherche d’adresses, estimation Google, prix annoncé, réservation immédiate, catégories de véhicules.
- Attribution au chauffeur, acceptation protégée des doubles attributions, suivi et états de course.
- Confirmation de prise en charge par PIN, annulations et frais selon les règles existantes.
- Paiements carte/portefeuille/espèces, transactions, versements et commissions selon les règles existantes.
- Messagerie de course, coordonnées et véhicule du chauffeur, notes, historique.
- Documents professionnels privés, vérification administrative et blocage de disponibilité en cas de documents invalides.
- Justificatif de réservation préalable, informations d’exploitant chauffeur.
- Export de données personnelles et demande de suppression de compte.
- Administration des chauffeurs, utilisateurs, courses, tarifs, assistance et signalements.
- Carte OpenStreetMap, radars et ouverture GPS externe uniquement sur bouton.
- Conditions, confidentialité et mentions légales (avec champs société encore incomplets).

## À terminer hors de ce code

- Fournir les informations réelles de la société, sa déclaration, les assurances et le médiateur ; faire valider les textes et obligations applicables à l’exploitant.
- Autoriser l’URL de retour `/recover-account` dans Supabase/Lovable et tester réellement les e-mails (configuration et délivrabilité non vérifiées ici).
- Vérifier les paiements, webhooks et versements avec la configuration de production ; les tests locaux ne réalisent aucun mouvement d’argent.
- Une facture réglementaire numérotée nécessite l’identité réelle de l’émetteur, les règles fiscales et comptables et une numérotation persistante. Le reçu ajouté ne la remplace pas. Le schéma de base de données est géré par Lovable et n’a pas été modifié.
- Tester les parcours sur iPhone/Android et avec les comptes client, chauffeur et administrateur avant ouverture.

Les modifications antérieures du panneau de course minimaliste et de l’ouverture GPS sont conservées localement ; elles sont distinctes de ces ajouts.
