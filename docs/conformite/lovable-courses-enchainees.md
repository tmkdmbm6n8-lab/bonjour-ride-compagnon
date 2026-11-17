# Demande prête pour Lovable — prochaine course en fin de trajet

## Demande du propriétaire

Proposer une nouvelle demande au chauffeur pendant une course réellement en cours lorsque le temps de conduite restant jusqu’à sa destination est inférieur ou égal à 180 secondes et que la prise en charge suivante est accessible depuis cette destination en au plus 300 secondes. Les deux durées doivent provenir d’un calcul Google avec trafic récent. Ne modifier aucun prix, calcul tarifaire, commission ou lien fournisseur.

## État de cette livraison

`src/lib/vtc-next-ride.js` contient les critères purs et testés, sans effet de bord ni modification des tarifs. Cette règle n’est pas branchée sur l’attribution existante : le schéma interdit actuellement plusieurs courses actives par chauffeur et il n’existe pas de file atomique. La fonctionnalité n’est donc PAS active en production. Ne pas supprimer simplement l’index `one_active_driver` et ne pas simuler une réservation avec un état uniquement dans le navigateur.

## Schéma et transactions à réaliser via Lovable

- Créer un état explicite pour la course réservée ensuite, distinct d’une course déjà prise en charge, et une file persistante limitée à une prochaine course par chauffeur. Conserver une seule course en prise en charge/transport par chauffeur et empêcher plusieurs courses réservées au même client. Adapter les contraintes existantes proprement, pas en les supprimant sans équivalent.
- Définir une transaction de réservation qui verrouille la prochaine course et la place du chauffeur dans la file, vérifie la course courante et toutes les conditions d’éligibilité, puis réserve la course suivante une seule fois. Deux acceptations concurrentes ou deux demandes du même chauffeur ne doivent produire ni double attribution ni deux places dans sa file.
- Ajouter une promotion atomique et idempotente après la fin effective de la course courante : la prochaine course devient l’unique course de prise en charge. Le règlement existant de la première course reste inchangé. Prévoir la reprise au prochain appel serveur si le client perd le réseau entre fin et promotion.
- Prévoir annulation du client suivant, refus du chauffeur, délai d’expiration, interruption de la course courante, suspension et déconnexion. Nettoyer ou remettre en recherche la réservation suivante selon des règles explicites, sans changer silencieusement les frais ou les paiements.
- Autorisations serveur/RLS : seuls les participants et l’administration habilitée voient la réservation. Le prochain passager ne doit jamais voir le nom, l’adresse, les messages ou la destination du passager courant.

## Intégration serveur et interface après migration

1. Garder les chauffeurs proches de leur arrivée comme candidats à l’enchaînement sans les annoncer libres ou afficher une fausse position. Respecter catégories, préférences et refus existants.
2. Rafraîchir le temps restant de la course actuelle, puis calculer l’approche de la destination actuelle vers la prise en charge suivante. Utiliser `nextRideEligibility`, vérifier à nouveau au clic d’acceptation ; pas de distance à vol d’oiseau, de vieille durée, de temps négatif ou de tarif utilisé comme temps de trajet.
3. Rendre ces candidats éligibles lors de la disponibilité/réservation, y compris s’il n’y a aucun chauffeur déjà libre, sans recalculer les prix différemment.
4. L’offre doit indiquer « Course suivante », le temps restant actuel, l’approche après dépose et l’attente totale prévisible du prochain client. Une offre normale ne doit pas laisser croire que le chauffeur est déjà libre.
5. Accepter une offre suivante ne remplace jamais l’écran ni l’état de la course en cours. Afficher une carte compacte de la prochaine réservation avec la possibilité de la gérer ; conserver le bouton de fin de course actuelle et ne pas ouvrir le GPS automatiquement.
6. Afficher au prochain client que le chauffeur termine une course. Son estimation d’attente inclut le temps restant actuel plus l’approche suivante, sans lui transmettre les données de la course courante.
7. Lors de la promotion, mettre à jour le suivi client/chauffeur et le poller, puis proposer le bouton GPS externe habituel pour la prise en charge suivante. Ne pas modifier le PIN de la première course ou son règlement.
8. Les notifications et les offres doivent être envoyées une seule fois après transaction gagnante. Les événements répétés ne doivent pas créer une seconde réservation.

## Recette indispensable

- 180 s / 300 s acceptés ; 181 s ou 301 s refusés ; contrôles de rôles, catégories, préférences, ancienneté des données et identités d’origine/destination.
- Aucune troisième course ; une seule place suivante ; aucun mélange des deux clients et aucun prix modifié.
- Deux chauffeurs acceptent la même prochaine course ; deux prochaines courses tentées en parallèle par le même chauffeur ; un seul résultat cohérent.
- Annulation du prochain client pendant le trajet courant ; fin du trajet courant après coupure réseau ; double appel de promotion ; suspension ; réservation abandonnée.
- Le passager actuel reste dans sa propre course ; le chauffeur ne voit la suivante comme active qu’après promotion ; le prochain client voit l’attente correcte.

Le déploiement de cette migration et de l’intégration complète nécessite Lovable conformément à AGENTS.md. Ce document ne constitue pas une migration appliquée.
