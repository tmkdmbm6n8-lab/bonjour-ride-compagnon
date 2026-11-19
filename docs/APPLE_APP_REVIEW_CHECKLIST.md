# Checklist de soumission App Store — StrasDrive

> Exclusion demandée : **ne pas modifier** le chargement du site distant par Capacitor (règle 4.2). Cette règle reste un risque non résolu.

## À compléter par l'éditeur avant toute soumission

- [ ] Remplacer **tous** les champs entre crochets de `src/lib/legal.js` par des informations authentiques : raison sociale, SIREN/RCS, adresse, contact, DPO, déclaration de centrale, médiateur, etc.
- [ ] Valider les mentions légales, les CGU, la politique de confidentialité et les délais de conservation réels.
- [ ] Fournir à Apple un compte passager de démonstration et un compte chauffeur approuvé, avec instructions de course de test sans facturation réelle.
- [ ] Compléter les formulaires App Privacy : localisation précise, coordonnées, documents chauffeur, messages/images/audio, identifiants, paiements et diagnostics selon l'usage réel.
- [ ] Examiner l'éligibilité de StrasDrive Gold au paiement Stripe hors application / à StoreKit avant la soumission. Ne pas masquer l'offre à l'équipe Apple.
- [ ] Vérifier la suppression du compte avec courses, documents, abonnements et opérations financières ; prévoir les obligations de conservation comptable sans conserver un compte actif.
- [ ] Vérifier les capacités iOS/APNs, l'accès aux photos, au micro, à la localisation et les textes d'autorisation `Info.plist`.
- [ ] Vérifier les images d'icône dans `Assets.xcassets` : 1024 × 1024, opaque, sans canal alpha.
- [ ] Exécuter `npm run ios:prepare-appstore` **sur le projet Xcode existant** puis contrôler les valeurs ; `ITSAppUsesNonExemptEncryption=false` seulement si l'usage cryptographique est réellement exempté.
- [ ] Faire une archive Xcode, installer sur iPhone réel, tester inscription, réservation, paiements tests, chat, signalement, suppression de compte et absence de crash.
- [ ] Auditer les fonctions de signalement de police/radars et les exigences françaises de sécurité routière : ne pas supposer que ces fonctions sont conformes.
- [ ] Prévoir la procédure humaine de traitement rapide des signalements et de suspension des utilisateurs abusifs.
- [ ] Vérifier la disponibilité de l'assistance et les liens publics de contact.
- [ ] Préparer captures d'écran réelles, description, catégorie, classification d'âge et notes destinées à App Review.

## Limites des changements automatiques

Le filtrage des menaces explicites dans le chat n'est **pas** un système complet de modération (variantes linguistiques, harcèlement contextuel, images, audio). Un lien de signalement permet d'alerter l'assistance, mais la gestion humaine et les moyens de blocage doivent être validés. Ne pas utiliser cette checklist comme certificat de conformité Apple.
