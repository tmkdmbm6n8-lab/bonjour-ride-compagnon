# Discussion : médias et conservation

Les participants d’une course acceptée, arrivée ou en cours peuvent envoyer un texte, un vocal (enregistrement limité à 60 s, fichier de 1 Mo maximum), une image JPEG/PNG/WebP (4 Mo maximum) ou une position ponctuelle. La permission microphone/localisation n’est demandée qu’au clic. Le vocal se réécoute et peut être supprimé avant l’envoi.

Les fichiers sont dans le bucket privé `ride-chat-private`, créé automatiquement par le serveur au premier envoi. Aucun accès public ni nouvelle politique d’accès navigateur : le serveur vérifie la course, le participant et l’état avant d’émettre une URL valable au plus 60 secondes. Seules des données binaires de formats explicitement autorisés sont acceptées. Il ne s’agit pas d’un appel audio ou d’un suivi continu.

À la clôture ou à l’annulation, les échanges sont retirés de `rides.messages` et leurs fichiers supprimés. Si un signalement a été enregistré avant la clôture, une archive privée est conservée dans le stockage d’assistance existant, hors de l’adresse e-mail des participants. Elle contient les quatre types d’échange, les participants et l’échéance fixée 14 jours après le premier signalement. Un second signalement ne repousse pas l’échéance. Les signalements eux-mêmes et les documents comptables conservent leurs propres durées. Les archives sont signées côté serveur ; une entrée du formulaire public ne peut pas fabriquer une archive.

L’administrateur consulte `/admin/chat-evidence` (« Échanges signalés »). Après expiration, l’API refuse l’accès, même si une purge doit être réessayée. Les fichiers sont supprimés avant l’enregistrement d’archive ; en cas d’échec le travail reste en attente de réessai. Les sauvegardes du fournisseur peuvent garder des copies jusqu’à leur rotation habituelle et ne doivent pas être restaurées en production sans rejouer la purge.

## Activation obligatoire de la purge planifiée dans Lovable

Le code du job est prêt mais la tâche n’est pas créée depuis cet environnement : le connecteur Lovable n’est pas disponible.

- Méthode : POST.
- URL : `/api/public/jobs/chat-retention` sur le domaine publié.
- Fréquence recommandée : toutes les 5 minutes (`*/5 * * * *`).
- Authentification : mécanisme Cron Lovable existant (`LOVABLE_CRON_SECRET`), comme le job weekly-payouts ; ne jamais mettre cette valeur dans GitHub ou dans le navigateur.
- Vérifier un premier appel réussi et les journaux, puis superviser les échecs. Le job traite des lots de 500 courses / 1000 archives et se répète ; le rapprocher si le volume augmente.

L’accès aux archives est bloqué à l’échéance exacte. L’effacement physique se produit au prochain passage du job, au plus cinq minutes plus tard si le service est disponible. La consultation des archives déclenche aussi un rattrapage. Sans activation du job, ne pas annoncer une purge physique garantie sans trafic.

Le texte de la discussion et la politique de confidentialité expliquent cette règle. Vérifier l’enregistrement iPhone/Safari, le refus du microphone, les images, le partage de position, la fermeture de course, le signalement avant clôture, et l’accès administrateur après publication.
