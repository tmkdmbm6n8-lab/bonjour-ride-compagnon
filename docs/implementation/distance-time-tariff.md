# Barème distance et durée — 24 novembre 2026

Instruction utilisateur : remplacer le précédent système d’estimation et retirer son intégration externe de l’application et du code courant.

| Gamme | Base | €/km | €/minute | Minimum avant supplément | Supplément |
|---|---:|---:|---:|---:|---:|
| Go | 1,90 | 0,99 | 0,29 | 12,00 | 0 |
| Confort | 2,43 | 1,27 | 0,37 | 18,00 | 0 |
| Pet | 1,90 | 0,99 | 0,29 | 12,00 | 4,00 |
| XL | 6,93 | 1,49 | 0,49 | 16,00 | 0 |

Prix = arrondi au centime de `max(minimum, base + mètres/1000 × €/km + secondes/60 × €/minute) + supplément`.
Les mètres et secondes ne sont pas arrondis avant le calcul. Le minimum final Pet est donc 16 €. Aucune remise, majoration liée à la demande ou frais de réservation ne modifie cette grille. La commission standard existante de 10 % et les règles Gold restent séparées du total passager. La fin de course conserve le prix et les gains acceptés.

Les estimations publiques et authentifiées, la réservation et le paiement par carte utilisent le même pipeline serveur. Seules les quatre gammes sont lues dans `pricing_rules`. Une ancienne règle sans `tariffVersion` est ignorée ; les modifications administrateur doivent être validées pour la version courante, avec une liste limitée de champs. Ceci active immédiatement les nouveaux tarifs sans dépendre du contenu historique de la base.

Les collecteurs, interfaces, sondes de session, routes planifiées et modules de l’ancien système ont été supprimés. Les types et l’arbre de routes ont été nettoyés ; l’arbre de routes est régénéré par le build. Les anciens artefacts SQL spécifiques retirés ne sont pas exécutés : aucune commande de suppression de données ou de tables n’a été lancée sur une base existante. L’historique Git reste intact.

Validation : build client/serveur réussi ; 53 tests du calcul, du pipeline de devis, du paiement et des garanties de suivi passent. La suite complète compte 520 réussites et quatre échecs préexistants (recherche d’adresse, deux attentes d’interface chauffeur et une attente d’expiration de QR). Les nouveaux fichiers compilés et les sources ne contiennent plus de référence au fournisseur retiré.

Le manifeste d’intégrité a été actualisé uniquement pour les trois blocs de prix explicitement remplacés ; l’entrée du module supprimé a été retirée. Le contrôle `check:pricing` signale encore l’ancien décalage de `src/lib/vtc-checkout.js`, dont le contenu reste identique au commit de départ. Ce hash n’a pas été modifié pour masquer ce décalage.
