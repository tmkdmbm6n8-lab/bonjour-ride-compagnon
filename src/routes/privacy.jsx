import {createFileRoute} from '@tanstack/react-router';
import PublicLayout from '@/components/PublicLayout';
import {COMPANY, HOST, LEGAL_UPDATED_LABEL} from '@/lib/legal';

const linkStyle = { fontWeight: 600, color: 'var(--text)' };

function PrivacyPage() {
  return (
    <article className="prose-page">
      <h1>Politique de confidentialité</h1>
      <p className="updated">Dernière mise à jour : {LEGAL_UPDATED_LABEL}</p>

      <p> Cette politique explique quelles données StrasDrive traite, pourquoi, combien de temps elles sont gardées et comment exercer vos droits, conformément au Règlement général sur la protection des données (RGPD) et à la loi Informatique et Libertés. Nous ne vendons pas vos données et ne les utilisons pas à des fins publicitaires. </p>

      <p>Vous pouvez partager volontairement un résumé de course à une personne de votre choix à l’aide du partage de votre téléphone ou du presse-papiers. Ce résumé contient les adresses, la référence de course et, lorsqu’ils sont disponibles, le nom du chauffeur et l’immatriculation. Il ne contient pas le code PIN et ne donne pas accès à un suivi public en direct. La plateforme ne choisit pas le destinataire et ne conserve pas de copie supplémentaire de ce partage.</p>
      <h2>1. Responsable du traitement</h2>
      <p> {COMPANY.legalName}, {COMPANY.address} (voir les{' '}
        <a href="/mentions-legales" style={linkStyle}>mentions légales</a>). Contact données personnelles : {COMPANY.dpoEmail}, ou la{' '}
        <a href="/contact" style={linkStyle}>page de contact</a> (sujet « Confidentialité / demande concernant les données »). </p>

      <h2>2. Les données que nous traitons</h2>
      <ul>
        <li><strong>Compte</strong> — nom, nom d’utilisateur, adresse e-mail, mot de passe (stocké sous forme chiffrée irréversible), rôle (passager ou chauffeur), et si vous les ajoutez : téléphone et photo de profil.</li>
        <li><strong>Preuve d’acceptation</strong> — date et version des conditions d’utilisation et de la présente politique acceptées à l’inscription.</li>
        <li><strong>Courses</strong> — adresses de départ et d’arrivée, itinéraire, distance et durée, prix et son détail, horaires (création, acceptation, arrivée, fin), gamme choisie, code PIN de départ, notes, commentaires et messages échangés pendant la course, ainsi que votre note moyenne de passager au moment de la commande (calculée à partir d’au moins 3 notes, elle sert seulement à respecter la note minimale qu’un chauffeur peut choisir ; elle ne lui est pas affichée).</li>
        <li><strong>Localisation</strong> — passagers : votre position actuelle, seulement si vous l’autorisez dans votre navigateur, pour proposer l’adresse de départ. Chauffeurs : votre position est transmise uniquement lorsque vous êtes en ligne ou en course ; seule la dernière position est gardée.</li>
        <li><strong>Signalements police et radar</strong> — chauffeurs : quand vous signalez ou confirmez un contrôle ou un radar, nous enregistrons sa position et votre identifiant de compte (pour éviter les votes en double). Les autres chauffeurs voient seulement le repère, jamais qui l’a signalé.</li>
        <li><strong>Portefeuille</strong> — solde, recharges, paiements de courses, mode de paiement choisi (portefeuille ou espèces), revenus, commissions, demandes de retrait et leurs décisions administratives, frais d’annulation et virements hebdomadaires aux chauffeurs (montant, date, frais de retrait anticipé). Les numéros de carte sont saisis chez Stripe et ne nous parviennent jamais.</li>
        <li><strong>Chauffeurs</strong> — véhicule (marque, modèle, année, couleur, plaque, gamme), statut d’approbation, statistiques d’activité, temps de connexion en ligne par jour (heure de Paris), et compte de versement Stripe, ainsi que le nom ou la raison sociale, l’adresse et le téléphone de l’exploitant pour le justificatif de réservation préalable. Sur l’application Android, l’identifiant de notification du téléphone, conservé jusqu’à la déconnexion, la désinstallation de l’application ou la suppression du compte.</li>
        <li><strong>Documents professionnels des chauffeurs</strong> — copies de la pièce d’identité, du permis de conduire, de la carte professionnelle VTC, de l’immatriculation de l’entreprise (SIRET), de l’inscription au registre VTC, de la carte grise, des attestations d’assurance, de la signalétique VTC, de l’attestation de vigilance URSSAF et, le cas échéant, du contrôle technique ; avec leur numéro, leur date de validité et le résultat de la vérification. Ils sont stockés dans un espace privé, visibles uniquement par le chauffeur et l’équipe StrasDrive.</li>
        <li><strong>Avis reçus par les chauffeurs</strong> — tableau de répartition des 500 dernières notes au maximum, publié avec un délai de 12 heures. Le détail des avis se débloque à 50 notes pour les chauffeurs ordinaires, qui consultent alors les commentaires positifs (4 ou 5 étoiles) ; les chauffeurs prioritaires peuvent consulter tous leurs commentaires sans seuil de 50 notes. Les avis sont présentés sans identité, coordonnées, date précise ni référence de course permettant de retrouver leur auteur. Les distinctions du profil chauffeur sont calculées sur le nombre total de notes de 5 étoiles reçues pour des courses chauffeur terminées, hors tests, avec le même délai de publication. Un indicateur conservé dans les statistiques du compte permet de ne jouer l’animation du premier déblocage qu’une seule fois ; il est supprimé avec le compte.</li>
        <li><strong>Chauffeur favori et clients privés</strong> — le lien entre un passager et son chauffeur favori (un seul à la fois) et sa date. Il est créé seulement sur action du passager : après une course terminée avec ce chauffeur ou en scannant son QR code. Le QR code contient un code aléatoire valable 5 minutes ; nous n’en gardons qu’une empreinte. Le scan crée une invitation valable 24 heures pour laisser le temps de créer le compte et de confirmer l’e-mail. Le passager voit le prénom, l’initiale du nom, la photo, la note, le véhicule, le nombre de courses ensemble et, lors d’une recherche, la disponibilité et le temps d’approche du chauffeur ; le chauffeur voit dans « Clients privés » le prénom, l’initiale du nom et la photo de ses clients. Le retrait ou le remplacement du favori est signalé au chauffeur dans son Inbox, sans nommer le passager.</li>
        <li><strong>Assistance</strong> — nom, e-mail, sujet et contenu des messages envoyés via le formulaire de contact et conversations avec l’administration dans Inbox. Le microphone et la position ponctuelle ne sont utilisés que sur votre action ; les images sont choisies par vous. Les pièces jointes de discussion sont stockées dans un espace privé. Retirer une conversation de l’Inbox chauffeur la masque dans l’Inbox de ce compte, sans effacer la copie conservée par l’administration ; une nouvelle réponse la rend à nouveau visible. Les signalements de chauffeur comprennent le motif, le commentaire éventuel et les références de la course et des participants, pour traiter la réclamation. Après trois courses signalées, l’activité chauffeur est automatiquement suspendue ; le mode passager reste disponible et le chauffeur peut contacter l’assistance pour demander un réexamen.</li>
      </ul>

      <p>Le temps de connexion chauffeur est calculé à partir des échanges avec le serveur, attente comprise. Les interruptions réseau de plus de deux minutes ne sont pas comptées. Les totaux journaliers sont conservés au maximum un an dans les statistiques du compte, puis retirés lors de son actualisation ; ils sont supprimés avec le compte.</p>
      <h2>3. Pourquoi et sur quelle base légale</h2>
      <ul>
        <li><strong>Fournir le service</strong> (compte, devis, attribution de la course aux chauffeurs disponibles selon leur niveau de priorité et leur distance, suivi, paiement, rémunération du chauffeur) — exécution du contrat (art. 6.1.b RGPD).</li>
        <li><strong>Sécurité</strong> (code PIN, notes réciproques, prévention de la fraude) — intérêt légitime à protéger passagers et chauffeurs (art. 6.1.f).</li>
        <li><strong>Vérification des documents des chauffeurs</strong> (carte VTC, registre VTC, assurances, attestation de vigilance URSSAF) — obligation légale de la centrale de réservation (Code des transports, article L8222-1 du Code du travail).</li>
        <li><strong>Comptabilité et obligations légales</strong> (conservation des opérations financières, réponses aux autorités) — obligation légale (art. 6.1.c).</li>
        <li><strong>Avis reçus par les chauffeurs</strong> — tableau de répartition des 500 dernières notes au maximum, publié avec un délai de 12 heures. Le détail des avis se débloque à 50 notes pour les chauffeurs ordinaires, qui consultent alors les commentaires positifs (4 ou 5 étoiles) ; les chauffeurs prioritaires peuvent consulter tous leurs commentaires sans seuil de 50 notes. Les avis sont présentés sans identité, coordonnées, date précise ni référence de course permettant de retrouver leur auteur. Les distinctions du profil chauffeur sont calculées sur le nombre total de notes de 5 étoiles reçues pour des courses chauffeur terminées, hors tests, avec le même délai de publication. Un indicateur conservé dans les statistiques du compte permet de ne jouer l’animation du premier déblocage qu’une seule fois ; il est supprimé avec le compte.</li>
        <li><strong>Assistance</strong> — exécution du contrat ou intérêt légitime à répondre à vos demandes.</li>
        <li><strong>Mesure d’audience</strong> sans cookie (voir section 7) — intérêt légitime à améliorer le service.</li>
        <li><strong>Position du passager</strong> — votre accord, donné et retirable à tout moment dans les réglages de votre navigateur.</li>
      </ul>
      <p> L’attribution d’une course (au chauffeur favori seul pendant 30 secondes si le passager l’a choisi, sinon d’abord aux chauffeurs prioritaires désignés par StrasDrive, puis au chauffeur le plus proche, puis à tous les chauffeurs disponibles) et le calcul du prix sont automatisés ; ils ne produisent pas d’effet juridique vous concernant au sens de l’article 22 du RGPD. </p>

      <h2>4. Qui reçoit vos données</h2>
      <ul>
        <li><strong>L’autre participant à la course</strong> — le chauffeur voit votre nom, le lieu de départ et la destination ; le passager voit le nom, la photo, la note, le véhicule et la plaque du chauffeur. Le justificatif de réservation préalable accessible au chauffeur attribué comporte le nom et le téléphone du client pour les contrôles réglementaires. La discussion courante passe par l’application.</li>
        <li><strong>{HOST.name}</strong> ({HOST.address}) — hébergement de l’application et de la base de données, envoi des e-mails de confirmation de compte, mesure d’audience.</li>
        <li><strong>Firebase Cloud Messaging</strong> (Google, États-Unis / Irlande) — envoi des notifications de nouvelle course sur l’application Android des chauffeurs et des demandes de retrait aux administrateurs ayant activé les notifications Android : identifiant de notification du téléphone, montant de la course et adresse de prise en charge.</li>
        <li><strong>Resend</strong> — lorsque son envoi est activé, transmet les alertes de demande de retrait aux adresses e-mail des administrateurs ; ces alertes contiennent une référence de demande, sans coordonnées bancaires.</li>
        <li><strong>Stripe</strong> — paiement par carte des recharges et des courses (e-mail et identifiant de compte transmis pour rattacher le paiement), versements aux chauffeurs et gestion de l’abonnement StrasDrive Gold. Pour Gold, Stripe reçoit l’identifiant du chauffeur et nous communique les identifiants de facturation, le statut et les échéances de l’abonnement. Le suivi de l’accès Gold dans StrasDrive est supprimé avec le profil chauffeur.</li>
        <li><strong>Google Maps Platform</strong> (Google, États-Unis / Irlande) — reçoit les adresses recherchées et les coordonnées à convertir en adresse, les points de départ et d’arrivée, puis la position du chauffeur pendant la course, pour calculer les itinéraires et les temps de trajet avec le trafic. Les recherches et calculs passent par notre serveur sans votre identité ; les cartes sont chargées directement par votre navigateur auprès d’OpenFreeMap, avec les données OpenStreetMap ; le fournisseur de tuiles reçoit votre adresse IP. Les radars proviennent de la Sécurité routière et d’OpenStreetMap (Overpass en secours hors de France), ainsi que des signalements des chauffeurs ; leur recherche transmet une zone de carte depuis notre serveur, sans votre identité. Si vous ouvrez la navigation dans Plans Apple, Google Maps ou Waze, l’application choisie reçoit la destination.</li>
        <li><strong>Horaires de transport</strong> — nos serveurs consultent les tableaux publics de l’aéroport de Strasbourg et l’API gratuite Train Nomade (données SNCF) sans transmettre votre identité ni votre position à ces sources.</li>
<li><strong>Autorités</strong> — uniquement lorsque la loi l’exige.</li>
      </ul>
      <p> Lorsque des données sont traitées hors de l’Union européenne, ces transferts sont encadrés par les garanties prévues par le RGPD (décision d’adéquation ou clauses contractuelles types de la Commission européenne). </p>

      <h2>5. Combien de temps</h2>
      <ul>
        <li><strong>Compte</strong> — tant que le compte est ouvert. Une demande de suppression est examinée après vérification de l’identité ; les données sont supprimées ou anonymisées sous réserve des obligations de conservation et des autres exceptions légales.</li>
        <li><strong>Textes, messages vocaux, images et positions partagées dans la discussion</strong> — supprimés à la fin de la course sans signalement. Si un signalement est envoyé avant la clôture, les échanges sont conservés dans un espace réservé à l’administration pendant 14 jours à compter du premier signalement, puis supprimés automatiquement, fichiers compris. Les liens temporaires vers les fichiers expirent en une minute au maximum.</li>
        <li><strong>Adresses précises et tracé des courses</strong> — 3 ans, puis arrondis à environ 1 km.</li>
        <li><strong>Montants des courses et opérations du portefeuille</strong> — 10 ans, durée imposée pour les pièces comptables (article L123-22 du Code de commerce), puis supprimés.</li>
        <li><strong>Dossier de course figé</strong> — à la fin de chaque course terminée ou annulée (hors courses de test), un dossier non modifiable est créé pour l’administration. Sa partie comptable (prix, part chauffeur, commission, mode de paiement, opérations du portefeuille liées, statuts et horaires) est conservée jusqu’au 31 décembre de la dixième année suivant la clôture, puis supprimée. Les noms et téléphones déclarés, les adresses, le véhicule, l’exploitant et ses numéros SIREN/REVTC figés pour le bulletin de réservation sont effacés 3 ans après la réservation. Le dossier ne contient ni messages, ni vocaux, ni images, ni positions de la discussion. Ces durées s’appliquent aussi après la suppression d’un compte. Un dossier peut être gelé le temps d’un litige en cours. Chaque consultation d’un dossier par un administrateur est enregistrée et ce journal est supprimé avec le dossier.</li>
        <li><strong>Dernière position d’un chauffeur</strong> — effacée lors du passage hors ligne sans course active ; la purge existante supprime aussi les anciennes positions hors ligne après 24 heures.</li>
        <li><strong>Signalements police et radar</strong> — contrôles de police effacés 2 heures après leur dernier signalement ; un radar reste jusqu’à sa suppression par l’administrateur.</li>
        <li><strong>Messages d’assistance (formulaire et Inbox)</strong> — 3 ans après l’envoi.</li>
        <li><strong>Chauffeur favori</strong> — tant que le passager ne le retire pas, puis supprimé immédiatement ; supprimé aussi avec le compte du passager ou du chauffeur. Codes des QR codes : supprimés 1 jour après leur expiration ; invitations scannées : supprimées 1 jour après leurs 24 heures de validité. Une invitation scannée avant connexion est gardée au plus 24 heures dans le stockage local du navigateur.</li>
        <li><strong>Preuve d’acceptation des conditions</strong> — tant que le compte est ouvert.</li>
        <li><strong>Documents des chauffeurs</strong> — tant que le compte chauffeur est ouvert, puis supprimés avec le compte. Un document remplacé par une version plus récente est supprimé immédiatement.</li>
      </ul>
      <p> Ces suppressions sont faites automatiquement chaque nuit. </p>

      <p>Le justificatif de réservation préalable est constitué à la demande à partir de la course, du profil client, des informations de l’exploitant et de ses documents approuvés. Pour une course clôturée, ses éléments sont figés dans le dossier de course décrit ci-dessus et effacés au bout de 3 ans ; ils ne sont jamais reconstitués à partir des profils actuels. Si le chauffeur le télécharge, il conserve lui-même le document sur son appareil.</p>
<h2>6. Ce qui est enregistré sur votre appareil</h2>
      <p> Lorsque vous êtes connecté, votre navigateur garde un jeton de session (dans son stockage local) pour que vous restiez connecté ; il est supprimé à la déconnexion. Il est indispensable au service et ne sert pas à vous suivre. Nous n’utilisons aucun cookie publicitaire ni de traceur de réseau social. La police d’écriture est servie par notre propre site. Vos favoris de transports et les indicateurs de lecture de la messagerie sont mémorisés localement dans ce navigateur, séparément pour chaque compte. Ils ne servent pas au suivi publicitaire. </p>

      <h2>7. Mesure d’audience</h2>
      <p> Pour savoir comment le site est utilisé, nous utilisons l’outil de mesure d’audience de Lovable. Il n’utilise aucun cookie, n’enregistre rien sur votre appareil, ne conserve pas votre adresse IP et ne permet pas de vous identifier. Lovable collecte ces données pour nous. <a href="https://lovable.dev/privacy" style={linkStyle} target="_blank" rel="noreferrer">La politique de confidentialité de Lovable</a> explique comment il les traite. </p>
      <p> Il enregistre les pages visitées, le site d’où vous venez, votre pays, votre navigateur, votre système d’exploitation et votre type d’appareil, le temps passé, la vitesse de chargement des pages et les erreurs. Ces informations sont enregistrées pour chaque visiteur, sans cookie et sans identifier personne. Les données détaillées sont gardées 90 jours et les résumés quotidiens un an. </p>

      <h2>8. Sécurité</h2>
      <p> Les échanges sont chiffrés (HTTPS). Les mots de passe ne sont jamais stockés en clair. L’accès aux données est limité par des règles qui ne permettent à chaque utilisateur de voir que ses propres courses et opérations ; seuls les administrateurs habilités accèdent aux outils de gestion. </p>

      <h2>9. Vos droits</h2>
      <p> Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité de vos données, ainsi que du droit de retirer votre accord et de définir des directives sur le sort de vos données après votre décès. </p>
      <ul>
        <li><strong>Modifier</strong> votre nom et votre téléphone : depuis votre profil.</li>
        <li><strong>Télécharger</strong> une copie de vos données : bouton « Télécharger mes données » dans votre profil.</li>
        <li><strong>Supprimer</strong> votre compte : bouton « Supprimer mon compte » dans votre profil.</li>
        <li><strong>Autres demandes</strong> : via la <a href="/contact" style={linkStyle}>page de contact</a> ou {COMPANY.dpoEmail}.</li>
      </ul>
      <p> Nous répondons en principe dans un délai d’un mois. Une prolongation motivée peut être appliquée dans les conditions prévues par le RGPD, après information de la personne concernée. Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (<a href="https://www.cnil.fr" style={linkStyle} target="_blank" rel="noreferrer">cnil.fr</a>). </p>

      <h2>10. Modifications</h2>
      <p> Nous vous informons dans l’application de toute modification importante de cette politique. </p>
    </article>
  );
}

export const Route=createFileRoute('/privacy')({head:()=>({meta:[{title:"Politique de confidentialité · StrasDrive"},{name:'description',content:"Données traitées par StrasDrive, finalités, destinataires, durées de conservation et droits RGPD des passagers et chauffeurs."},{property:'og:title',content:"Politique de confidentialité · StrasDrive"},{property:'og:description',content:"Comment StrasDrive traite vos données de compte et de course, combien de temps, et comment exercer vos droits RGPD."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <PublicLayout><PrivacyPage/></PublicLayout>});
