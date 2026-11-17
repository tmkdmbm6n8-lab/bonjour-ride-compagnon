# Demande prête pour Lovable — notes, factures et avoirs

État : spécification à réaliser dans Lovable, pas un système déjà actif. Aucun SQL de migration n’a été écrit ou appliqué. Le projet interdit la modification manuelle de `supabase/migrations/` et `drizzle/` dans AGENTS.md.

## Décisions à obtenir avant émission

Identifier les véritables émetteurs : exploitant transporteur pour le transport, plateforme pour sa commission/frais selon les contrats. Renseigner les identités légales, SIREN/SIRET, adresses, régime de TVA, taux ou exonérations, client professionnel ou particulier et mandat de facturation si la plateforme émet pour un exploitant. Faire valider ces décisions par le comptable ; ne pas déduire un taux du véhicule ou du montant TTC.

## Travail demandé

1. Créer côté base une série de numérotation par émetteur et série comptable validée. L’allocation du numéro et la création du document doivent être une transaction atomique avec verrouillage, unicité et idempotence. Aucun compteur navigateur ou numéro fondé uniquement sur la référence de course.
2. Conserver des instantanés immuables des identités vendeur/client, dates, devise, libellés, montants HT/TVA/TTC en unités monétaires entières, taux/régime, mentions obligatoires et référence de course/paiement. Distinguer note de course, facture de transport, facture de commission et avoir. Conserver les justificatifs comptables selon la politique légale validée, distinctement des données de géolocalisation purgées.
3. Une course ou un événement de paiement rejoué ne doit pas créer un second document. Une facture émise n’est pas modifiée ni supprimée pour corriger un remboursement : établir un avoir lié selon les règles comptables validées. Conserver la trace des erreurs et corrections sans briser la séquence.
4. Refuser l’émission si les identités, le régime fiscal ou les mentions nécessaires sont incomplets. Les réservations de test ne doivent produire aucun document fiscal réel. Le reçu de course actuel reste explicitement distinct.
5. Émettre ou rendre disponible la note récapitulative avant encaissement lorsqu’elle est légalement requise ; traiter également les demandes en dessous du seuil applicable. Vérifier le placement exact par rapport à l’encaissement Stripe, au portefeuille et au paiement espèces. Ne pas qualifier un simple récapitulatif d’avant réservation de note finale si les conditions ne sont pas remplies.
6. Définir des autorisations serveur : le client accède uniquement à ses documents, le chauffeur à ceux qui le concernent et l’administration habilitée aux documents nécessaires. Aucune clé de service dans le navigateur et aucun stockage public. Les téléchargements doivent être authentifiés ou signés avec durée limitée.
7. Rendre les documents téléchargeables dans l’historique client/chauffeur et transmettre la notification par le service e-mail configuré. Ajouter le journal d’envoi et sa reprise sans duplication. Ne pas promettre un e-mail délivré si le fournisseur l’a refusé.
8. Mettre à jour les types générés par les outils officiels, la politique de confidentialité et la purge selon les nouvelles données réellement conservées ; vérifier la procédure d’export/suppression et les exceptions légales d’archivage.
9. Traiter les obligations françaises de facturation électronique et d’e-reporting avec le prestataire comptable selon le calendrier, la taille des entreprises et le type d’opération applicables ; ne pas supposer qu’un PDF suffit dans tous les cas.

## Critères de recette

- Émissions concurrentes pour le même émetteur : numéros uniques et séquence cohérente ; rejeu du même événement : même document.
- Modification de l’identité de l’émetteur après émission : aucune altération de la facture historique.
- Adresse ou fiscalité manquante : refus explicite, pas de zéro ou d’identité inventés.
- Espèces : pas d’affirmation d’encaissement sur la seule clôture d’une course.
- Annulation, remboursement partiel/complet, double webhook, reprise après panne : résultats comptables contrôlés et documentés.
- Un client A ne peut pas télécharger la facture d’un client B ; document de test jamais mélangé à la production.
- Aucune donnée bancaire sensible, aucun PIN ou jeton dans les documents et journaux.

Sources : https://entreprendre.service-public.gouv.fr/vosdroits/F23208 ; https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/taxis-vtc-motos-pro-ce-quil-faut-savoir?language=fr
