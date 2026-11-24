import {createFileRoute} from '@tanstack/react-router';
import PublicLayout from '@/components/PublicLayout';
import {COMPANY, LEGAL_UPDATED_LABEL} from '@/lib/legal';
import {EARLY_PAYOUT_FEE} from '@/lib/vtc-payouts';
import {DRIVER_MIN_NET_PER_RIDE, DRIVER_MIN_NET_PER_HOUR, DRIVER_MIN_NET_PER_KM, DEFAULT_PRICING, formatEuro} from '@/lib/vtc-pricing';

const linkStyle = { fontWeight: 600, color: 'var(--text)' };

function TermsPage() {
  return (
    <article className="prose-page">
      <h1>Conditions générales d’utilisation</h1>
      <p className="updated">Dernière mise à jour : {LEGAL_UPDATED_LABEL}</p>

      <p> Les présentes conditions générales d’utilisation (« Conditions ») régissent l’utilisation de StrasDrive, service édité par {COMPANY.legalName} (voir les{' '}
        <a href="/mentions-legales" style={linkStyle}>mentions légales</a>). Elles s’appliquent aux passagers et aux chauffeurs. Vous les acceptez en cochant la case prévue lors de la création de votre compte. </p>

      <h2>1. Le service</h2>
      <p> StrasDrive est une centrale de réservation de VTC (articles L3142-1 et suivants du Code des transports). Elle met en relation des passagers avec des chauffeurs VTC indépendants, calcule le prix de la course avant la réservation, gère le paiement (carte bancaire, portefeuille ou espèces) et le suivi de la course. Le transport est réalisé par un exploitant VTC indépendant. Le rôle de mise en relation de StrasDrive ne supprime pas les responsabilités que la loi impose à une centrale de réservation. Toute course est réservée à l’avance via l’application : un chauffeur VTC ne peut pas être hélé dans la rue. </p>

      <h2>2. Comptes</h2>
      <ul>
        <li>Vous devez être majeur, fournir des informations exactes et garder vos identifiants confidentiels.</li>
        <li>Un seul compte par personne. Votre adresse e-mail doit être confirmée avant la première connexion.</li>
        <li>Vous pouvez télécharger vos données ou demander la suppression de votre compte à tout moment depuis votre profil.</li>
      </ul>

      <h2>3. Prix, réservation et annulation (passagers)</h2>
      <ul>
        <li>Le prix total TTC de la course est affiché avant la réservation, pour chaque gamme. Il est calculé à partir d’un prix de base, de la distance et de la durée estimée, avec un minimum par catégorie. Le supplément Pet de 4 € est ajouté après application du minimum. Le prix accepté ne change pas pendant la course.</li>
        <li>Si la tarification dynamique est activée, un ajustement selon la zone de départ, le jour, l’heure de Paris et la catégorie peut réduire ou majorer le barème, dans le respect des minimums chauffeurs. Pour une réservation programmée, le créneau de départ prévu est utilisé. Hors des zones configurées ou si le système est désactivé ou indisponible, seul le barème classique s’applique. Les frais de réservation sont nuls.</li>
        <li>L’annulation est gratuite tant que le chauffeur n’est pas arrivé au point de prise en charge. Après son arrivée, des frais d’annulation de {formatEuro(3)} sont débités, dont {formatEuro(2.76)} reversés au chauffeur.</li>
        <li>Au départ, le passager communique au chauffeur un code PIN à usage unique. Ne montez jamais dans un véhicule qui ne correspond pas à celui affiché.</li>
        <li>Les contrats de transport de passagers relèvent de l’exclusion prévue à l’article L221-2, 9°, du Code de la consommation. Le délai général de rétractation de quatorze jours ne s’applique donc pas à la course ; les règles d’annulation indiquées ici restent applicables. Les droits éventuellement applicables à une recharge de portefeuille sont distincts.</li>
      </ul>

      <h2>4. Portefeuille et paiement</h2>
      <ul>
        <li>Les courses sont payées avec le solde de votre portefeuille StrasDrive (que vous rechargez du montant de votre choix, entre 5 € et 1 000 €), en espèces au chauffeur, ou par carte bancaire au moment de la commande. Une course payée par carte est créditée sur votre portefeuille puis débitée à la fin de la course ; si elle est annulée, le montant reste sur votre portefeuille. Les paiements par carte passent par notre prestataire Stripe : StrasDrive ne voit ni ne conserve votre numéro de carte.</li>
        <li>Le prix de la course est débité à la fin de celle-ci. Chaque opération figure dans l’historique de votre portefeuille.</li>
        <li>Vous pouvez aussi choisir de payer en espèces au moment de la réservation : vous remettez alors le prix annoncé directement au chauffeur à la fin de la course, sans débit de votre portefeuille. La commission StrasDrive est alors déduite du portefeuille du chauffeur. Aucun frais d’annulation n’est prélevé sur une course payée en espèces.</li>
        <li>Le solde n’est utilisable que pour des courses StrasDrive et n’est pas transférable. Vous disposez de 14 jours pour vous rétracter d’une recharge non utilisée (article L221-18 du Code de la consommation). Le solde non utilisé est remboursé sur demande à la clôture du compte.</li>
      </ul>

      <h2>5. Chauffeurs</h2>
<p>Découvrir présente les horaires disponibles publiés par les sources gratuites de transport. Les horaires prévus et le suivi en temps réel sont distingués ; une information absente ou périmée n’est pas présentée comme confirmée. Le signal de retour potentiel indique une arrivée de vol compatible avec la fin estimée de la course et la proximité de l’aéroport ; il ne garantit ni client, ni réservation, ni revenu. Les durées affichées dans Revenus correspondent aux courses terminées et à leur approche enregistrée, pas au temps total de connexion hors course.</p>
<p>Le bouton Waybill donne accès au justificatif électronique de réservation préalable pour la course attribuée au chauffeur. Pour les réservations immédiates, l’heure de prise en charge souhaitée correspond à l’heure de la commande enregistrée. Le chauffeur renseigne l’identité et les coordonnées de l’exploitant ; les numéros SIREN et REVTC sont issus de ses documents approuvés. Le justificatif indique les informations manquantes et ne peut être téléchargé tant qu’il est incomplet. Le chauffeur vérifie les informations et présente le justificatif lors d’un contrôle. Une course fictive ne produit pas de justificatif de transport réel.</p>
      <ul>
        <li>Le chauffeur exerce en indépendant. Il doit détenir une carte professionnelle VTC valide, être inscrit au registre des exploitants VTC, disposer d’un véhicule conforme et d’une assurance couvrant le transport de personnes à titre onéreux. Son compte est activé après vérification par StrasDrive des documents suivants : pièce d’identité, permis B de plus de 3 ans, carte professionnelle VTC, immatriculation de l’entreprise (Kbis, RNE ou SIRENE de moins de 3 mois), inscription au registre VTC, carte grise, assurance transport de personnes à titre onéreux, responsabilité civile professionnelle, signalétique VTC et attestation de vigilance URSSAF de moins de 6 mois (plus le contrôle technique si le véhicule y est soumis). Le chauffeur tient ces documents à jour : un document expiré ou refusé l’empêche de passer en ligne jusqu’à son remplacement.</li>
        <li>Le chauffeur choisit librement ses horaires : il se connecte et se déconnecte quand il le souhaite. Avant d’accepter une course, il voit le lieu de prise en charge, la destination, la distance, la durée et sa rémunération. Il peut refuser une course sans pénalité (article L7342-8 du Code du travail).</li>
        <li>Commission de la plateforme : {DEFAULT_PRICING.economy.platformCommission} % du prix de la course. Le reste revient au chauffeur.</li>
        <li>StrasDrive Gold donne accès au QR code d’invitation, à la liste active de clients privés et à la mise en avant du chauffeur auprès de ses clients. L’abonnement coûte 19,99 € TTC par mois après sept jours d’essai offerts à la première souscription. Sans carte enregistrée, l’essai prend fin sans prélèvement. L’abonnement est renouvelé chaque mois et peut être résilié depuis le portail de facturation. Une résiliation programmée prend effet à la fin de la période en cours. L’accès Gold est inclus pour les chauffeurs prioritaires. La commission de 15 % reste applicable pendant l’essai et pour l’accès offert. Après le premier paiement, aucune commission plateforme ne s’applique aux courses acceptées tant que l’abonnement payant est actif.</li>
        <li>Les gains du chauffeur sont conservés sur son solde StrasDrive et virés automatiquement sur son compte bancaire chaque semaine, dans la nuit de dimanche à lundi à minuit (heure de Paris), sans frais. Le virement bancaire passe par Stripe, une fois les coordonnées bancaires du chauffeur vérifiées.</li>
        <li>Le chauffeur peut demander un retrait anticipé d’au moins 10 € (montant total débité, frais inclus). Les frais existants de {formatEuro(EARLY_PAYOUT_FEE)} sont déduits du montant demandé. La demande ne débite pas le solde : le débit et le lancement du virement interviennent uniquement après validation de l’administration. Une demande refusée avant validation ne débite rien. Une seule demande peut être en attente ou en traitement à la fois.</li>
        <li>Pour une course payée en espèces, la commission due à StrasDrive est inscrite au débit du solde du chauffeur et reprise automatiquement sur ses courses suivantes payées par carte bancaire, avant tout virement.</li>
      </ul>

      <h2>6. Rémunération minimale des chauffeurs</h2>
      <p> Les paramètres de suivi de la rémunération nette chauffeur sont les suivants : </p>
      <ul>
        <li>{formatEuro(DRIVER_MIN_NET_PER_RIDE)} nets par course, quelle que soit la distance ou la durée ;</li>
        <li>{formatEuro(DRIVER_MIN_NET_PER_HOUR)} nets par heure d’activité, temps d’approche compris ;</li>
        <li>{formatEuro(DRIVER_MIN_NET_PER_KM)} net par kilomètre parcouru.</li>
      </ul>
      <p> Ces paramètres de suivi sont distincts du barème passager. Le prix annoncé au passager reste fixe et le calcul ne régularise pas automatiquement les minima selon la durée réelle. Les paramètres de calcul ne valent pas attestation du respect de toutes les garanties applicables aux chauffeurs ; toute régularisation légalement due demeure à la charge de son débiteur et doit être traitée par l’exploitant. La rémunération est créditée sur le portefeuille du chauffeur dès la fin de la course. </p>

      <h2>7. Comportement</h2>
      <ul>
        <li>Respectez chauffeurs et passagers ; le harcèlement et la discrimination entraînent l’exclusion.</li>
        <li>La fraude et toute manipulation de l’attribution ou des prix sont interdites.</li>
        <li>Les notes et messages doivent être honnêtes et appropriés.</li>
      </ul>

      <h2>8. Suspension et résiliation</h2>
      <p> Nous pouvons suspendre un compte qui enfreint les présentes Conditions ou présente un risque pour la sécurité, après vous en avoir informé et en vous permettant de présenter vos observations, sauf urgence. Vous pouvez fermer votre compte à tout moment depuis votre profil. </p>

      <h2>9. Responsabilité</h2>
      <p> StrasDrive met en œuvre les moyens nécessaires au bon fonctionnement du service. En tant que centrale de réservation, elle répond envers le client de la bonne exécution des obligations du contrat de transport dans les conditions de l’article L3142-3 du Code des transports, y compris lorsque la prestation est réalisée par un chauffeur partenaire. Les possibilités d’exonération sont celles prévues par ce texte. Cette responsabilité est distincte des obligations de l’exploitant et de ses assurances ; aucune clause ne limite les droits impératifs du consommateur. </p>

      <h2>Information sur l’attribution des courses</h2>
      <p>L’attribution tient compte de la disponibilité du chauffeur, de la gamme demandée, des conditions de prise en charge et des préférences de course compatibles. Le mécanisme donne d’abord accès aux chauffeurs marqués prioritaires par l’administration, puis au chauffeur éligible le plus proche, puis aux autres chauffeurs disponibles. Un mécanisme de répartition peut limiter les offres d’un chauffeur non prioritaire dont les revenus dépassent ceux des autres chauffeurs disponibles. La première acceptation validée par le serveur attribue la course. Certaines courses se terminant près d’une gare ou d’un aéroport au moment d’une arrivée peuvent être réservées aux chauffeurs Gold. Une arrivée ne garantit aucune réservation de retour. La priorité administrative ne constitue pas une garantie de course ou de revenu. Les commissions applicables sont indiquées dans les présentes Conditions.</p>
      <p>Les notes correspondent à des courses de la plateforme ; le tableau chauffeur présente les 500 dernières notes au maximum avec un délai de 12 heures. Les commentaires sont anonymisés : les chauffeurs ordinaires accèdent au détail à partir de 50 notes et voient les commentaires positifs de 4 ou 5 étoiles, les prioritaires voient tous les commentaires sans ce seuil, sans coordonnées des auteurs ; aucune note n’est présentée comme un contrôle indépendant. Une réclamation sur une attribution ou une note peut être adressée à l’assistance.</p>
      <h2>Réclamations et documents de course</h2>
      <p>Le détail d’une course dans l’historique permet de contacter l’assistance avec sa référence, de signaler un problème de paiement ou un objet oublié et de télécharger le récapitulatif disponible. Ce récapitulatif ne remplace pas une facture réglementaire de l’émetteur compétent. Une demande de facture peut être adressée à l’assistance. L’identité de l’émetteur, les mentions fiscales et la numérotation des factures sont distinctes du numéro de réservation.</p>
      <p>En cas de litige, une réclamation écrite peut être déposée via la page Contact. Après cette démarche et dans les conditions légales applicables, le consommateur peut saisir le médiateur désigné dans les mentions légales. Le signalement auprès de la DGCCRF est également accessible sur <a href="https://signal.conso.gouv.fr/" style={linkStyle} target="_blank" rel="noreferrer">SignalConso</a>.</p>

      <h2>10. Modifications</h2>
      <p> Toute modification importante des Conditions vous est annoncée dans l’application avant son entrée en vigueur. </p>

      <h2>11. Litiges et droit applicable</h2>
      <p> Les présentes Conditions sont soumises au droit français. En cas de litige, contactez d’abord notre service client via la{' '}
        <a href="/contact" style={linkStyle}>page de contact</a>. À défaut d’accord, vous pouvez saisir gratuitement le médiateur de la consommation indiqué dans les{' '}
        <a href="/mentions-legales" style={linkStyle}>mentions légales</a>, puis les tribunaux compétents. </p>
    </article>
  );
}

export const Route=createFileRoute('/terms')({head:()=>({meta:[{title:"Conditions d’utilisation · StrasDrive"},{name:'description',content:"Conditions générales d’utilisation de StrasDrive : réservation VTC, prix, portefeuille, chauffeurs et rémunération minimale."},{property:'og:title',content:"Conditions d’utilisation · StrasDrive"},{property:'og:description',content:"Réservation, prix annoncés à l’avance, annulation, portefeuille et rémunération minimale des chauffeurs StrasDrive."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <PublicLayout><TermsPage/></PublicLayout>});
