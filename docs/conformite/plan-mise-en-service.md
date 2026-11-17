# Mise en service de StrasDrive — dossier de travail

État : préparation technique au 17 novembre 2026. Ce dossier n’est ni une homologation ni une attestation juridique. L’identité de l’entreprise, la médiation, les assurances et la déclaration ont été reportées par le propriétaire. Le panneau administratif de préparation (ancien point 10) est également reporté.

## 1. Centrale de réservation : démarches de l’entreprise

- Identifier l’entité qui exploite le service et vérifier la qualification exacte de son activité.
- Préparer et déposer la déclaration de centrale de réservation auprès de l’autorité compétente, puis suivre les renouvellements et changements applicables. Conserver la preuve réelle du dépôt et les échéances ; rien n’a été déposé depuis cette conversation.
- Souscrire et vérifier une RC professionnelle couvrant spécifiquement l’activité de centrale de réservation ; contrôler la période, les exclusions et le périmètre géographique avec l’assureur. La RC du chauffeur ne remplace pas celle de la centrale.
- Faire valider les contrats d’intermédiation, la responsabilité de la centrale, les conditions passagers/chauffeurs et les garanties applicables aux travailleurs de plateforme par un professionnel du droit.

Sources : [chapitre des centrales de réservation](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000023086525/LEGISCTA000033737603/), [responsabilité L3142-3](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033737658), [assurance L3142-4](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033737665).

## 2. Documents chauffeurs et véhicules

Le projet dispose déjà d’un stockage privé de documents, d’une validation administrative et d’un blocage de disponibilité lorsque les pièces requises sont invalides. L’administrateur doit contrôler l’authenticité et la portée des pièces, pas uniquement le fichier envoyé ou sa date saisie. Vérifier les cartes professionnelles, permis, exploitant/REVTC, assurances transport et RC pro, véhicule et signalétique. Vérifier la conformité du véhicule, les dérogations et le contrôle technique selon la situation réelle. Ne pas utiliser l’option d’approbation exceptionnelle pour contourner une obligation légale. Tenir un registre d’échéances opérationnel et une procédure de suspension en cas de document non valable.

Source : [informations officielles VTC et droits des passagers](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/taxis-vtc-motos-pro-ce-quil-faut-savoir?language=fr).

## 3. Information client et médiation

Compléter les mentions légales avec les informations réelles ; choisir et contractualiser avec le médiateur compétent avant de publier son nom. Faire valider le rôle contractuel des exploitants et les commissions. Le site dispose d’un prix avant réservation, d’un choix de paiement, de règles d’annulation et d’un canal de réclamation identifié par la référence de course. Les conditions ont été précisées sur la responsabilité de la centrale, le champ du droit de rétractation et le mécanisme d’attribution. Les textes restent à valider au regard du modèle réel.

Source : [information des plateformes](https://www.economie.gouv.fr/dgccrf/laction-de-la-dgccrf/les-enquetes-et-les-controles/les-obligations-dinformation-des-plateformes-numeriques).

## 4. Notes de course, factures et comptabilité

Le reçu actuel est un récapitulatif téléchargeable, pas une facture fiscale. Il ne suffit pas à démontrer la remise d’une note avant paiement ou l’émission d’une facture au nom du bon exploitant. Le parcours doit permettre la remise du document applicable avant encaissement lorsqu’elle est requise, notamment à partir de 25 € TTC et sur demande en dessous, selon les règles du transport concerné. Définir avec le comptable l’émetteur de chaque document (transport, commission, frais), le mandat de facturation éventuel, les règles de TVA, les mentions, les avoirs et les durées de conservation. Ne pas utiliser le numéro de course, une date ou un compteur local comme numéro de facture.

La demande technique pour Lovable est préparée dans `lovable-facturation.md`. L’émission automatique, la numérotation et l’archivage probant ne sont pas activés.

Sources : [information officielle taxis/VTC](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/taxis-vtc-motos-pro-ce-quil-faut-savoir?language=fr), [facturation](https://entreprendre.service-public.gouv.fr/vosdroits/F23208).

## 5. RGPD et sécurité

Compléter le registre de traitements joint, identifier les contrats de sous-traitance et vérifier les transferts, les localisations de données et les garanties effectives des fournisseurs. Contrôler les droits d’accès client/chauffeur/admin, la politique des documents privés, les sauvegardes, la purge programmée, l’export et la suppression. Vérifier les traitements de géolocalisation et l’information au moment de leur utilisation. Évaluer la nécessité d’une AIPD selon les risques, l’échelle et les traitements réellement déployés ; elle n’est ni déclarée faite ni déclarée inutile ici. Préparer une procédure de violation de données et la gestion des demandes de droits.

Les durées de purge codées dans le projet ne sont pas changées. Leur existence dans le dépôt ne prouve pas que le job s’exécute en production.

Sources : [géolocalisation — CNIL](https://www.cnil.fr/fr/geolocalisation-applications-mobiles-quelles-regles), [responsables et sous-traitants](https://www.cnil.fr/fr/responsable-de-traitement-et-sous-traitant-6-bonnes-pratiques-pour-respecter-les-donnees), [violations de données](https://www.cnil.fr/fr/violations-de-donnees-personnelles-les-regles-suivre).

## 6. Paiements et recette avant ouverture

Confirmer avec le prestataire de paiement et le conseil compétent le modèle d’encaissement pour compte de tiers et du portefeuille. Vérifier les comptes exploitants, KYC, webhooks signés, remboursements, rapprochement, commissions et versements avec les services réels. Ne pas confondre un paiement en mode test avec une transaction réelle. Vérifier également les minima et éventuelles régularisations chauffeurs : le moteur actuel utilise des estimations à la réservation et n’atteste pas une garantie calculée sur la durée réelle.

Faire une recette documentée : réservation, absence de chauffeur, double acceptation concurrente, annulation selon l’étape, PIN incorrect, course terminée, espèces, carte, remboursement, reçu/facture, réclamation, expiration d’un document, restauration de sauvegarde, export et suppression. Utiliser d’abord des comptes et paiements de test ; tout paiement réel requiert un scénario autorisé séparément.
