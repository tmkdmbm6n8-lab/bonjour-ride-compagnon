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
      <p> StrasDrive est une centrale de réservation de VTC (articles L3142-1 et suivants du Code des transports). Elle met en relation des passagers avec des chauffeurs VTC indépendants, calcule le prix de la course avant la réservation, gère le paiement (portefeuille ou espèces) et le suivi de la course. Le transport est réalisé par le chauffeur, qui en est responsable ; StrasDrive ne transporte pas elle-même de passagers. Toute course est réservée à l’avance via l’application : un chauffeur VTC ne peut pas être hélé dans la rue. </p>

      <h2>2. Comptes</h2>
      <ul>
        <li>Vous devez être majeur, fournir des informations exactes et garder vos identifiants confidentiels.</li>
        <li>Un seul compte par personne. Votre adresse e-mail doit être confirmée avant la première connexion.</li>
        <li>Vous pouvez télécharger vos données ou demander la suppression de votre compte à tout moment depuis votre profil.</li>
      </ul>

      <h2>3. Prix, réservation et annulation (passagers)</h2>
      <ul>
        <li>Le prix total TTC de la course est affiché avant la réservation, pour chaque gamme. Il dépend de la distance, de la durée estimée, de la demande et inclut la rémunération minimale due au chauffeur. Il ne change pas pendant la course.</li>
        <li>Si le tarif calculé est inférieur à ce minimum, un « complément de rémunération minimale chauffeur » est ajouté et affiché avant la validation.</li>
        <li>L’annulation est gratuite tant que le chauffeur n’est pas arrivé au point de prise en charge. Après son arrivée, des frais d’annulation de {formatEuro(3)} sont débités, dont {formatEuro(2.76)} reversés au chauffeur.</li>
        <li>Au départ, le passager communique au chauffeur un code PIN à usage unique. Ne montez jamais dans un véhicule qui ne correspond pas à celui affiché.</li>
        <li>Conformément à l’article L221-28 du Code de la consommation, une course réservée pour une date déterminée n’ouvre pas de droit de rétractation.</li>
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
        <li>Commission de la plateforme : {DEFAULT_PRICING.economy.platformCommission} % du prix de la course ({DEFAULT_PRICING.premium.platformCommission} % pour la gamme Premium). Le reste revient au chauffeur.</li>
        <li>Les gains du chauffeur sont conservés sur son solde StrasDrive et virés automatiquement sur son compte bancaire chaque semaine, dans la nuit de dimanche à lundi à minuit (heure de Paris), sans frais. Le virement bancaire passe par Stripe, une fois les coordonnées bancaires du chauffeur vérifiées.</li>
        <li>Le chauffeur peut retirer son solde avant cette date : des frais de retrait anticipé de {formatEuro(EARLY_PAYOUT_FEE)} sont alors déduits.</li>
        <li>Pour une course payée en espèces, la commission due à StrasDrive est inscrite au débit du solde du chauffeur et reprise automatiquement sur ses courses suivantes payées par portefeuille, avant tout virement.</li>
      </ul>

      <h2>6. Rémunération minimale des chauffeurs</h2>
      <p> Conformément à l’accord conclu au sein de l’Autorité des relations sociales des plateformes d’emploi (ARPE), chaque course garantit au chauffeur, après commission, le plus élevé des montants suivants : </p>
      <ul>
        <li>{formatEuro(DRIVER_MIN_NET_PER_RIDE)} nets par course, quelle que soit la distance ou la durée ;</li>
        <li>{formatEuro(DRIVER_MIN_NET_PER_HOUR)} nets par heure d’activité, temps d’approche compris ;</li>
        <li>{formatEuro(DRIVER_MIN_NET_PER_KM)} net par kilomètre parcouru.</li>
      </ul>
      <p> Le prix passager est calculé pour couvrir ce minimum, avec un temps d’approche estimé. Le prix annoncé ne change pas pendant la course : si elle dure plus longtemps que prévu (embouteillages), ni le passager ni StrasDrive ne paient de supplément, et la commission de la plateforme reste inchangée. La rémunération est créditée sur le portefeuille du chauffeur dès la fin de la course. </p>

      <h2>7. Comportement</h2>
      <ul>
        <li>Respectez chauffeurs et passagers ; le harcèlement et la discrimination entraînent l’exclusion.</li>
        <li>La fraude et toute manipulation de l’attribution ou des prix sont interdites.</li>
        <li>Les notes et messages doivent être honnêtes et appropriés.</li>
      </ul>

      <h2>8. Suspension et résiliation</h2>
      <p> Nous pouvons suspendre un compte qui enfreint les présentes Conditions ou présente un risque pour la sécurité, après vous en avoir informé et en vous permettant de présenter vos observations, sauf urgence. Vous pouvez fermer votre compte à tout moment depuis votre profil. </p>

      <h2>9. Responsabilité</h2>
      <p> StrasDrive met en œuvre les moyens nécessaires au bon fonctionnement du service. Le chauffeur est responsable de l’exécution du transport. Aucune disposition des présentes Conditions ne limite les droits que vous tenez de la loi, notamment du Code de la consommation. </p>

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
