# StrasDrive — audit de préparation juridique (21 novembre 2026)

> Document de travail, non certificat de conformité. À faire valider par un professionnel du droit des transports et un expert-comptable avant lancement.

## Vérification du guide reçu

- Le guide affirme que les documents chauffeurs, le bon de réservation, les minima ARPE et la purge RGPD sont conformes. Ces affirmations **ne sont pas démontrées** par le seul fichier `src/lib/legal.js` et nécessitent des tests fonctionnels, un examen des flux et des justificatifs.
- **Attention au modèle économique :** **Modèle confirmé par le propriétaire :** commission de 15 % pour chaque course d'un chauffeur sans abonnement Gold payant actif ; commission de 0 % pour les courses acceptées pendant un abonnement Gold payant actif, sans plafond de courses. Le code consulté utilise `hasPaidDriverGold` lors de l'attribution et `waiveGoldCommission` pour annuler la commission ; il exige un abonnement actif et une facture Stripe payée non nulle. L'essai gratuit et l'accès Gold offert ne dispensent pas de commission. Les CG chauffeur (`src/routes/terms.jsx`) et les textes marketing consultés reflètent cette distinction. **À tester en conditions réelles**, notamment paiement initial, renouvellement, résiliation, expiration, indisponibilité Stripe, et courses acceptées avant/après changement d'abonnement.
- Les garanties de rémunération ARPE ne doivent pas être codées comme une règle universelle sans vérifier les accords applicables, les périodes, les modalités de calcul et le périmètre des courses.
- Le statut juridique de la centrale, les formalités et sanctions exactes doivent être confirmés sur les textes officiels à jour ; ne pas considérer les chiffres du guide comme validés.
- TVA : distinguer transport réalisé par le chauffeur, prestations de la plateforme, franchise en base, régime de TVA et statut du véritable fournisseur. Ne pas imposer 10 % ou 20 % à tous les cas sans analyse.
- Conservation RGPD : une purge des messages à 14 jours ou des données passagers à 3 ans n'est pas une preuve de conformité ; documenter les finalités, exceptions, droits, sous-traitants et durées effectives.
- Le nom et l'adresse de l'hébergeur dans `src/lib/legal.js` doivent être vérifiés auprès du prestataire réellement utilisé en production ; Lovable peut ne pas être l'hébergeur actuel.
- Les champs de `COMPANY` contiennent des espaces réservés : ne jamais publier de fausses coordonnées, de numéro de TVA ou de déclaration fictifs.

## Vérifications techniques avant mise en production

1. Contrôler toutes les pages qui importent `COMPANY` et `HOST`, y compris mentions légales, confidentialité, CGU et CGV.
2. Vérifier les justificatifs de réservation générés, horodatages, disponibilité hors réseau et présentation lors d'un contrôle.
3. Contrôler les justificatifs chauffeurs, dates d'expiration, restrictions d'accès et droits d'administration.
4. Revoir les règles de calcul des compléments ARPE et tester la non-duplication, les transactions et la séparation entre chauffeurs sur une base de test.
5. Auditer Stripe, la facturation au nom des chauffeurs, les éventuels mandats, remboursements et écritures comptables.
6. Auditer les traitements RGPD, la géolocalisation, les durées de conservation réellement appliquées et les procédures de suppression/export.
7. Effectuer des tests automatisés et un audit de sécurité avant toute mise en production.

## Actions réservées au propriétaire

- Confirmer la forme juridique, les coordonnées professionnelles et l'hébergeur réel ; fournir uniquement les informations exactes.
- Vérifier avec les autorités compétentes la déclaration de centrale de réservation et réaliser les démarches requises.
- Souscrire l'assurance adaptée à l'activité de plateforme, et adhérer à un médiateur compétent si l'activité B2C le requiert.
- Faire valider le régime de TVA, la facturation et les contrats/mandats avec un expert-comptable ou juriste.
- Approuver les textes légaux définitifs et les montants avant lancement.
- Créer un environnement Supabase de test, valider les essais, puis autoriser séparément toute activation de crédits ou paiements réels.

**Aucun paiement, crédit de portefeuille, migration SQL ni modification des coordonnées légales n'est autorisé par ce document.**

## Vérification ciblée du modèle de commission (21 novembre 2026)

- `src/lib/vtc-pricing.js` : quatre catégories (economy, comfort, pet, xl) affichent `platformCommission: 15`.
- `src/lib/vtc.server.js` : le tarif utilise 15 % par défaut ; le bénéfice 0 % est appliqué au moment de l'acceptation via `hasPaidDriverGold`, sauf courses de test.
- `src/lib/driver-gold.server.js` : le bénéfice sans commission exige `gold_status = active`, un abonnement Stripe identifié et au moins une facture payée avec montant strictement positif ; une mise en cache de 60 secondes est utilisée.
- `src/lib/driver-gold-fare.js` : retire la commission et l'ajoute au revenu chauffeur sans changer le total passager ; le tarif original peut être restauré si la course change de chauffeur.
- `src/routes/terms.jsx` : précise que l'essai et le Gold offert ne donnent pas la remise de commission ; elle débute après le premier paiement, tant que l'abonnement payant est actif.
- **Point restant** : les pages marketing simplifient parfois en « 0 % pour les abonnés Gold », sans distinguer essai gratuit et accès offert. Harmoniser ces textes pour éviter une promesse trompeuse.
- **Point restant** : vérifier par tests que la commission réellement comptabilisée lors du règlement correspond au tarif figé à l'acceptation, pour les courses carte et espèces.
