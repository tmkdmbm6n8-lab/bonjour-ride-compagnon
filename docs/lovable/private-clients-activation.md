# Clients privés et chauffeur favori — préparation de l'activation

Cette fonctionnalité n'est pas encore activée. Les modifications de schéma, de politiques et de fonctions de base de données doivent être réalisées dans Lovable, conformément à `AGENTS.md`. Ne pas afficher les nouveaux onglets comme opérationnels tant que les opérations serveur et les essais de bout en bout ne sont pas prêts.

## Parcours demandé

- Un client possède au plus un chauffeur favori ; il peut le retirer et remplacer explicitement un favori existant. Après une course, il peut ajouter le chauffeur depuis l'écran de notation.
- Un chauffeur voit ses clients privés et un QR code renouvelé toutes les cinq minutes, accompagné d'un compte à rebours. Le code expiré ne peut plus servir à démarrer une nouvelle inscription.
- Un nouveau client scanne le QR code et s'inscrit ; la relation est associée au compte après validation de son inscription, y compris si la confirmation de l'adresse e-mail est différée.
- L'onglet client « Chauffeur favori », à côté de « Voyager », présente les informations utiles du chauffeur et le nombre de courses ensemble. Le retrait doit générer une notification Inbox au chauffeur ; un remplacement doit aussi notifier l'ancien chauffeur.
- Une demande est proposée en priorité au chauffeur favori disponible, quelle que soit sa distance. Si son attente est trop longue, le client peut annuler cette attribution sans frais et demander un autre chauffeur. Une course doit toujours rester attribuée à un seul chauffeur.
- Si le chauffeur favori est occupé, afficher son état et l'estimation de fin de sa course en cours, puis d'approche du nouveau client. Sur choix explicite du client, lui proposer la course ; autrement, utiliser le dispatch normal. Si aucune estimation fiable n'est disponible, afficher un délai indisponible plutôt qu'une valeur inventée.

## Contrat de persistance à créer dans Lovable

1. Créer une relation `rider_favorite_drivers` avec clé unique sur `rider_id`, référence à `driver_id`, dates de création et mise à jour, et règles de suppression cohérentes avec la suppression de compte. Vérifier que les deux comptes existent, que le favori est bien chauffeur et qu'un utilisateur ne peut pas se choisir lui-même.
2. Créer un mécanisme d'invitations éphémères côté serveur : jeton aléatoire non devinable, empreinte stockée en base plutôt que jeton brut, chauffeur, émission et expiration au bout de 5 minutes. Ne jamais laisser le client choisir son `driver_id` sans vérifier le jeton. Une invitation créée pendant la validité du QR peut être associée à l'inscription, avec une durée limitée distincte permettant de confirmer l'e-mail ; son utilisation doit être atomique et idempotente.
3. Créer des opérations serveur transactionnelles pour ajouter, remplacer et retirer un favori : autorisation du client, confirmation explicite lors d'un remplacement et création atomique d'un événement de notification durable destiné à l'ancien chauffeur. Réessayer les notifications sans les dupliquer.
4. Prévoir des champs ou une table dédiée pour l'offre prioritaire, la décision du client d'attendre un chauffeur occupé, les échéances et l'annulation gratuite. La durée de réponse du favori reste à confirmer. Ne pas faire confiance aux indicateurs fournis par le navigateur pour supprimer des frais.
5. Prévoir une file d'attente atomique pour les propositions à un chauffeur occupé, distincte de sa course active. Le système doit empêcher deux attributions actives, gérer refus, expiration, déconnexion et annulation, et avertir le client en cas de changement. Une estimation n'est pas une garantie d'arrivée.
6. Limiter les lectures par rôle et propriétaire : un client ne voit que son propre favori ; un chauffeur ne voit que ses propres clients privés, avec les seules données nécessaires. RLS et autorisation côté serveur doivent être testées ; aucun jeton ni secret ne doit apparaître dans les journaux ou les URL d'analyse.
7. Mettre à jour la politique de confidentialité pour la relation, les notifications, les données affichées et les durées de conservation retenues ; programmer le nettoyage des invitations expirées.

## Contraintes d'intégration

- Préserver `src/lib/vtc-pricing.js`, le lien fournisseur, les devis, les prix, commissions et rémunérations.
- La priorité favori doit rester compatible avec les préférences chauffeur, l'approbation, les documents, les classes de véhicule, les courses test et la protection contre la double attribution. Un chauffeur hors ligne ou inéligible ne doit pas bloquer indéfiniment le dispatch normal.
- Lors du paiement par carte et de la confirmation différée, conserver le choix explicite de client pour éviter qu'une course change de circuit après paiement. La suppression des frais d'annulation pour une attribution favorite doit être vérifiée côté serveur avant toute écriture au portefeuille.
- Ne pas détourner `drivers.stats`, `profiles.rating` ou des messages d'assistance pour stocker silencieusement une relation permanente. Les notes et la vie privée des passagers restent séparées.
- Le QR doit pointer vers un parcours d'inscription de confiance, avec validation du jeton côté serveur ; gérer les scans multiples et l'inscription déjà existante sans affiliation non consentie.

## Vérification avant activation

Tester au minimum expiration du code, scan juste avant expiration et confirmation d'e-mail tardive, concurrence entre changements de favori, retrait et notification unique, changement avec et sans confirmation, chauffeur hors ligne ou occupé, choix explicite d'attente, expiration et refus de l'offre, attributions concurrentes, calcul de délai absent, annulation gratuite sans débit, paiement carte, client ordinaire, clients et chauffeurs non autorisés, suppression de compte et course test. Tester également les deux interfaces mobiles et PC ainsi que les reprises après reconnexion.

Vérifier `npm run check:pricing` après toute modification. Ne pas qualifier ce document ou un écran isolé de fonctionnalité activée.
