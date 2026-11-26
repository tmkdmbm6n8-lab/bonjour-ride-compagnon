# Inventaire initial des routes

Source : `src/routeTree.gen.ts`, branche main, blob `acf1ae935302e0fdd7f313acd3a47e0538da643e`.

Cet inventaire couvre les imports de routes générées, pas toutes les fonctionnalités internes, API ou écrans modaux. Aucun écran n'est déclaré migré. Les routes admin restent disponibles sur le web; leur éventuelle présence mobile doit être vérifiée.

| Route source | Destination provisoire | Parité |
|---|---|---|
| `__root` | À auditer | Non validé |
| `index` | À auditer | Non validé |
| `_authenticated/route` | À auditer | Non validé |
| `contact` | À auditer | Non validé |
| `join` | À auditer | Non validé |
| `login` | À auditer | Non validé |
| `mentions-legales` | À auditer | Non validé |
| `privacy` | À auditer | Non validé |
| `recover-account` | À auditer | Non validé |
| `signup` | À auditer | Non validé |
| `terms` | À auditer | Non validé |
| `_authenticated.become-driver` | À auditer | Non validé |
| `_authenticated.dashboard` | À auditer | Non validé |
| `_authenticated.favorite` | À auditer | Non validé |
| `_authenticated.profile` | À auditer | Non validé |
| `_authenticated.recurring` | À auditer | Non validé |
| `_authenticated.rides` | À auditer | Non validé |
| `_authenticated.transport` | À auditer | Non validé |
| `_authenticated.wallet` | À auditer | Non validé |
| `_authenticated.admin.alerts` | Administration web à conserver | Non validé |
| `_authenticated.admin.chat-evidence` | Administration web à conserver | Non validé |
| `_authenticated.admin.content-reports` | Administration web à conserver | Non validé |
| `_authenticated.admin.dashboard` | Administration web à conserver | Non validé |
| `_authenticated.admin.drivers` | Administration web à conserver | Non validé |
| `_authenticated.admin.monitoring` | Administration web à conserver | Non validé |
| `_authenticated.admin.pricing` | Administration web à conserver | Non validé |
| `_authenticated.admin.rides` | Administration web à conserver | Non validé |
| `_authenticated.admin.support` | Administration web à conserver | Non validé |
| `_authenticated.admin.users` | Administration web à conserver | Non validé |
| `_authenticated.driver.dashboard` | À auditer | Non validé |
| `_authenticated.driver.discover` | À auditer | Non validé |
| `_authenticated.driver.earnings` | À auditer | Non validé |
| `_authenticated.driver.inbox` | À auditer | Non validé |
| `_authenticated.driver.menu` | À auditer | Non validé |
| `_authenticated.driver.preferences` | À auditer | Non validé |
| `_authenticated.driver.private-clients` | À auditer | Non validé |
| `_authenticated.driver.profile` | À auditer | Non validé |
| `_authenticated.driver.reservations` | À auditer | Non validé |
| `_authenticated.driver.trips` | À auditer | Non validé |
| `_authenticated.driver.wallet` | À auditer | Non validé |
| `_authenticated.rides.$id` | À auditer | Non validé |
| `api/public/jobs/chat-retention` | Serveur uniquement | Non validé |
| `api/public/jobs/weekly-payouts` | Serveur uniquement | Non validé |
| `api/public/jobs/withdrawal-notifications` | Serveur uniquement | Non validé |
| `api/public/payments/webhook` | Serveur uniquement | Non validé |

Pour chaque écran client/chauffeur : inventorier composants, actions, API, droits, données consultables hors ligne, stockage sécurisé, états réseau, notifications et tests de parité. Vérifier également les fonctionnalités sans route dédiée et les API non déclarées dans cet arbre.
