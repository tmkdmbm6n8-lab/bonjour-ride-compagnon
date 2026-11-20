# StrasDrive Gold — revue de facturation et App Store

## Code vérifié

- `src/lib/driver-gold.js`: prix 1 999 centimes/mois, période d'essai 7 jours ; droit Gold déterminé par statut et échéance.
- `src/lib/driver-gold.server.js`: paiement Stripe Checkout en mode subscription ; vérification du prix Stripe en EUR, montant et caractère récurrent ; Billing Portal pour la gestion ; webhooks synchronisent le droit Gold.
- `src/lib/vtc.server.js`: Gold donne notamment accès à des informations trafic/retours aéroport-gare, influence la répartition de certaines courses et peut supprimer la commission de certaines courses payantes.
- `src/lib/driver-gold-fare.js`: calculs de commission Gold séparés des frais passager.

## Risque Apple — décision non automatisable

La course VTC est un **service physique**, normalement payable via Stripe. En revanche, Gold combine avantages commerciaux de mise en relation **et fonctionnalités numériques accessibles dans l'app**. Il n'est pas possible de conclure automatiquement que tout l'abonnement échappe à l'achat intégré Apple. Obtenir une qualification juridique/App Review avant publication iOS. Ne pas contourner les règles en dissimulant le produit.

## Vérifications obligatoires

1. Confirmer l'offre exacte affichée aux chauffeurs et sa qualification Apple (règles 3.1.1, 3.1.3) ; envisager une séparation entre services professionnels et fonctions numériques si nécessaire.
2. Tester le renouvellement, les échecs de paiement, les annulations et les remboursements en mode Stripe sandbox.
3. Vérifier la cohérence des états `trialing`, `active`, `past_due`, `canceled` avec les droits réellement accordés.
4. Vérifier que l'annulation de Gold n'interrompt pas une course et que la suppression du compte arrête les prélèvements.
5. Vérifier les mentions prix TTC, renouvellement automatique, essai, résiliation et support dans l'interface.

**Aucune migration automatique vers StoreKit n'a été appliquée :** changer le prestataire sans validation commerciale peut casser les abonnements actifs.
