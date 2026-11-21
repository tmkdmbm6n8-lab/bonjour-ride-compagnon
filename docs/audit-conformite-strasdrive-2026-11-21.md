# StrasDrive — audit de préparation juridique (21 novembre 2026)

> Document de travail, non certificat de conformité. À faire valider par un professionnel du droit des transports et un expert-comptable avant lancement.

## Vérification du guide reçu

- Le guide affirme que les documents chauffeurs, le bon de réservation, les minima ARPE et la purge RGPD sont conformes. Ces affirmations **ne sont pas démontrées** par le seul fichier `src/lib/legal.js` et nécessitent des tests fonctionnels, un examen des flux et des justificatifs.
- **Attention au modèle économique :** le guide évoque une commission de 15 %, alors que StrasDrive a aussi été présenté comme sans commission. Vérifier les contrats et le code tarifaire avant de publier des CGV ou des factures.
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
