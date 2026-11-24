# Tarification dynamique — 24 novembre 2026

L’administration > Tarification conserve le barème classique et ajoute un onglet Tarification dynamique. La fonction est désactivée initialement. Le switch enregistre immédiatement son état ; les autres modifications nécessitent « Enregistrer les paramètres ». Un rechargement restitue les paramètres enregistrés. Le simulateur peut prévisualiser une activation sans l’activer pour les clients.

## Données et géographie

Les cinq pourcentages généraux sont −30, −25, −15, −5 et 0 %. Une surcharge facultative par catégorie peut être négative, nulle ou positive ; une case vide hérite du général. La validation autorise −100 à +10 000 % et rejette les montants non finis. Les créneaux non renseignés restent toujours neutres, indépendamment du pourcentage du niveau « Très forte ».

Les sept zones initiales sont des cercles GPS ajustables, pas des limites administratives officielles. L’administrateur peut modifier nom, centre, rayon, activation, créer ou supprimer une zone et son planning. Un départ dans plusieurs cercles utilise la plus petite distance au centre divisée par le rayon ; une égalité garde l’ordre de configuration. Hors des zones actives, le barème est conservé.

Le fichier `src/data/dynamic-demand-history.json` transcrit 35 graphiques complets des captures IMG_4441 à IMG_4455 : cinq journées opérationnelles, mardi à samedi, pour sept zones. Les cinq hauteurs discrètes des barres ont été classées par ordre croissant ; aucun volume absolu ni lien statistique avec un prix réel n’est supposé. Chaque graphique commence à 4 h et finit à 3 h : ses quatre dernières barres appartiennent au jour civil suivant. Il y a donc 840 créneaux renseignés et 336 inconnus parmi les 1 176 initiaux. Le lundi entier, mardi avant 4 h et dimanche à partir de 4 h restent inconnus. Les captures partielles et le graphique de demande actuelle ne comblent aucun créneau manquant.

## Calcul et conservation des prix

Le barème classique `vtc-pricing.js` reste inchangé. Le serveur charge une configuration et un instant communs aux quatre catégories, puis applique au total classique le multiplicateur `1 + pourcentage / 100`, arrondi au centime. Europe/Paris détermine le jour et l’heure, avec changements saisonniers. Les réservations utilisent le départ prévu ; une demande récurrente est estimée sur sa prochaine occurrence. Le formulaire interprète explicitement ses heures locales dans Europe/Paris.

La réduction est limitée par les minimums configurés dans le moteur existant : minimum net par course et kilométrique après commission. Le suivi de garantie horaire existant reste distinct ; aucune nouvelle règle de règlement n’est introduite. Le simulateur sans distance présente la formule seule et l’annonce : le devis réel peut limiter la réduction. Le taux de commission est conservé, ainsi que les traitements Gold/clients privés existants. Le détail du devis inclut le pourcentage demandé, la base, le montant effectif, la protection éventuelle du minimum, le créneau, la zone et la révision de configuration.

Les courses et paiements par carte déjà confirmés conservent leur objet tarifaire enregistré. Une modification de configuration n’écrit jamais dans ces objets. Une modification explicite d’une demande de réservation par son passager conserve le circuit existant de nouvelle confirmation et reçoit un nouveau devis serveur. Les montants fournis par le navigateur ne déterminent pas le prix enregistré. Une réservation immédiate est calculée à l’instant présent, indépendamment d’une date arbitraire envoyée par le navigateur.

## Stockage et erreurs

La configuration utilise une seule ligne JSONB existante `pricing_rules`, clé `dynamic_pricing`, avec `is_active=false` afin de ne pas l’exposer par la politique de lecture publique des barèmes actifs. Aucune migration ni nouvelle table. Les lectures serveur utilisent le compte de service. `/api/admin/dynamic-pricing` vérifie le rôle administrateur depuis la session avant toute lecture privilégiée ou écriture. PUT enregistre les paramètres complets ; PATCH change seulement l’activation. Une révision et une comparaison atomique JSONB empêchent les écrasements concurrents ; la première insertion bénéficie de la clé primaire existante.

Chaque nouveau devis lit la configuration enregistrée sans cache. Une lecture défaillante, une configuration invalide ou une erreur de la couche dynamique rend le tarif classique. Le routage et la recherche d’adresses existants restent inchangés ; le calcul dynamique ne contacte aucune API externe et n’ajoute aucune dépendance.

## Vérification

Les tests `dynamic-pricing*` couvrent les exemples chiffrés, héritages par catégorie, majorations, inconnus, erreurs, persistance, concurrence, autorisations réelles, zones, heure de Paris/DST, minimums et snapshots, le pipeline des quatre devis, les réservations et le formulaire administrateur. Les tests existants de paiement et de tarification sont également exécutés, ainsi que la construction de production et la suite complète. Le contrôle d’intégrité conserve le défaut antérieur du hash de `vtc-checkout.js` ; seul le hash du bloc de devis modifié pour cette fonctionnalité est actualisé.
