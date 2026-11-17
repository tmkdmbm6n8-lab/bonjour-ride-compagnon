# Livraison technique — suite des obligations, prix exclus

État local au 17 novembre 2026. Aucun déploiement ou push n’a été fait pour ces changements. Aucun paiement, virement, remboursement ou e-mail réel n’a été déclenché pendant les vérifications. Les informations de société, déclarations, assurance de centrale, médiateur et ancien panneau administratif restent reportés.

## Réalisé dans le code

1. Actions de course : refus des méthodes HTTP inadaptées aux mutations et aux lectures.
2. Accès : tests du gestionnaire serveur contre l’accès administrateur par un client, les courses étrangères et les documents d’autres chauffeurs.
3. Documents professionnels : chemins limités au dossier plat du déposant, aux extensions attendues, sans traversée de répertoire ou URL déguisée. Les documents restent privés et soumis aux règles existantes de validation.
4. Géolocalisation : coordonnées bornées ; position effacée au passage hors ligne sans course active ; mises à jour reçues hors ligne sans course ignorées. Le suivi nécessaire à une course active reste autorisé.
5. HTTP : réponses privées et API non mises en cache ; en-têtes de type de contenu et de référent ajoutés, sans changer la compression ni les frames de paiement.
6. Stripe : signature HMAC vérifiée, comparaison des signatures de longueur fixe, rejet des dates invalides/périmées et séparation des environnements test/production.
7. Identité de paiement : une simple correspondance d’adresse e-mail ne réattribue plus un compte Stripe à un autre utilisateur. Aucun montant ou calcul de devis n’est modifié.
8. Facture : demande authentifiée dans le détail de course, autorisée au participant et transmise dans l’assistance existante. Les tests et courses non facturables sont exclus. Ce mécanisme n’émet pas de facture fiscale et ne garantit pas une numérotation comptable.
9. Assistance : suivi privé des demandes et réponses pour clients et chauffeurs depuis le profil ; pagination et contrôle de propriété des conversations, y compris à la réponse.
10. RGPD : export paginé des courses, transactions et demandes d’assistance ; récupération des pages supplémentaires au lieu d’une troncature silencieuse ; exclusion du PIN et des champs internes de diffusion.
11. Documentation : texte de confidentialité actualisé sur la position hors ligne et les demandes de suppression, sans annoncer un effacement automatique intégral. Les procédures d’ouverture, de droits, d’incident, de facture et de recette restent dans ce dossier.
12. Prix protégés : contrôle `npm run check:pricing`, avec empreintes du fournisseur de prix, des règles et des blocs d’estimation. La baseline provient de l’état précédant ces travaux et n’a pas été actualisée pour contourner un changement.

## Vérifications locales

Les tests couvrent l’autorisation serveur, les conversations privées, la pagination d’export, l’accès aux documents, les signatures de webhook, le rattachement de comptes de paiement et les fonctions préexistantes. Les appels de services sensibles sont simulés. Les tests ne prouvent ni l’état RLS réel de production, ni une restauration de base, ni une transaction ou une délivrabilité e-mail réelle.

La compilation de production et le contrôle d’intégrité des prix doivent passer avant livraison. La navigation et la récupération de compte doivent également être testées sur les appareils et domaines réellement utilisés ; un navigateur Chromium en largeur mobile ne remplace pas Safari sur un iPhone physique.

## Reste nécessitant Lovable, des services réels ou une décision de l’exploitant

- Facturation réglementaire : la demande est branchée, mais l’émission, la séquence comptable atomique, les notes avant paiement, les avoirs et l’archivage ne sont pas activés. Le dossier `lovable-facturation.md` précise les travaux. L’émetteur et les paramètres fiscaux ne seront pas inventés.
- Base réelle : vérifier l’application des politiques d’accès, les jobs de purge, les sauvegardes et une restauration. Le code et les migrations présents ne prouvent pas leur déploiement effectif.
- Services : vérifier KYC, versements, remboursements, rapprochements, délivrabilité et URL de retour des e-mails avec les comptes configurés. Aucun test financier réel n’est déclaré réussi ici.
- Organisation : authenticité des documents professionnels, conformité réelle des véhicules, gestion des demandes, contrats de sous-traitance, analyse de nécessité d’AIPD, procédures RGPD et validation juridique nécessitent des preuves et responsables réels.
- Tarification : tout changement de prix, du lien fournisseur, de commission, du calcul des garanties ou des régularisations reste explicitement exclu par l’instruction du propriétaire. Aucune garantie réglementaire sur l’activité réelle n’est déduite des seuls tests du calcul existant.

Le plugin Lovable a été identifié et proposé pour poursuivre la partie base de données ; son installation/sa connexion ne sont pas confirmées. AGENTS.md réserve les changements de schéma à Lovable : « Ask Lovable to change the schema. »

Ce dossier n’est pas une certification, homologation ou attestation de conformité exhaustive.
