import {createFileRoute} from '@tanstack/react-router';
import PublicLayout from '@/components/PublicLayout';


function TermsPage() {
  return (
    <article className="prose-page">
      <h1>Conditions d’utilisation</h1>
      <p className="updated">Dernière mise à jour : 12 août 2026</p>

      <p> Les présentes Conditions d’utilisation (« Conditions ») régissent votre accès à la plateforme StrasDrive et son utilisation — notre site web, nos applications et nos services qui mettent en relation des passagers avec des chauffeurs indépendants. En créant un compte ou en utilisant StrasDrive, vous acceptez les présentes Conditions. </p>

      <h2>1. Le service</h2>
      <p> StrasDrive est une plateforme technologique. Nous mettons les demandes de course en relation avec les chauffeurs à proximité, calculons les tarifs à l’avance, traitons les paiements par portefeuille et assurons le suivi des courses en direct. Les chauffeurs sont des prestataires indépendants de services de transport ; StrasDrive ne fournit pas elle-même de transport. </p>

      <h2>2. Un modèle économique équitable</h2>
      <p> StrasDrive donne la priorité aux chauffeurs. Notre commission de plateforme représente un faible pourcentage transparent de chaque course — affiché sur l’écran des revenus de chaque chauffeur — et sert uniquement à couvrir les coûts de fonctionnement de la plateforme. Le reste du prix de chaque course revient au chauffeur. Les tarifs des passagers sont affichés avant la réservation et ne changent jamais pendant la course, à l’exception des éventuels frais d’annulation décrits ci-dessous. </p>

      <h2>3. Comptes</h2>
      <ul>
        <li>Vous devez fournir des informations exactes et préserver la confidentialité de vos identifiants.</li>
        <li>Vous êtes responsable de toute activité effectuée avec votre compte.</li>
        <li>Un seul compte par personne ; vous devez avoir la capacité juridique de conclure un contrat.</li>
        <li>Les chauffeurs doivent disposer d’un permis valide, d’une assurance et d’un véhicule en état de circuler, et réussir notre procédure d’approbation.</li>
      </ul>

      <h2>4. Réservations, annulations et frais</h2>
      <ul>
        <li>Les tarifs sont annoncés à l’avance en fonction de la distance de l’itinéraire, de la durée et de la demande actuelle.</li>
        <li>Vous pouvez annuler gratuitement pendant que nous recherchons un chauffeur ou lorsque celui-ci est en route.</li>
        <li>De faibles frais d’annulation s’appliquent si vous annulez après l’arrivée de votre chauffeur ; la majeure partie de ces frais sert à indemniser le chauffeur.</li>
        <li>Les courses sont vérifiées à l’aide d’un code PIN à usage unique. Ne commencez jamais une course dans un véhicule qui ne correspond pas à celui affiché dans l’application.</li>
      </ul>

      <h2>5. Paiements, crédits de course et versements</h2>
      <p> Les courses sont payées au moyen de <strong>crédits de course</strong>, que vous achetez par carte bancaire et qui constituent le solde de votre portefeuille. Chaque achat et chaque dépense sont enregistrés dans un registre consultable depuis votre compte. </p>
      <ul>
        <li> Les crédits de course sont utilisables <strong>uniquement pour des courses StrasDrive</strong>. Ils ne constituent pas de l’argent, ne peuvent pas être échangés contre des espèces et ne peuvent pas être transférés à un autre utilisateur ou compte. </li>
        <li> Les achats de crédits sont définitifs et non remboursables, sauf lorsque la loi impose un remboursement ou lorsque nous annulons une course par erreur. </li>
        <li>Les crédits n’expirent pas tant que votre compte reste actif.</li>
        <li> Les tarifs des passagers sont affichés avant la réservation et sont déduits de vos crédits à la fin de la course. </li>
      </ul>
      <p>
        <strong>Revenus des chauffeurs</strong> sont crédités au chauffeur dès la fin d’une course et sont versés sur son propre compte bancaire via Stripe. Stripe collecte et conserve directement les coordonnées bancaires ; StrasDrive ne les stocke pas. Les versements sont soumis à la vérification de Stripe et arrivent généralement sous un à deux jours ouvrés. </p>

      <h2>6. Comportement</h2>
      <ul>
        <li>Traitez les chauffeurs et les passagers avec respect ; le harcèlement ou la discrimination entraînent l’exclusion.</li>
        <li>Toute utilisation illégale de la plateforme, toute fraude et toute ingérence dans les systèmes d’attribution ou de tarification sont interdites.</li>
        <li>Les notes et les messages doivent être honnêtes et appropriés.</li>
      </ul>

      <h2>7. Suspension et résiliation</h2>
      <p> Nous pouvons suspendre ou résilier les comptes qui enfreignent les présentes Conditions, présentent des risques pour la sécurité ou font un usage abusif de la plateforme. Les chauffeurs peuvent passer hors ligne à tout moment ; les passagers peuvent fermer leur compte à tout moment. </p>

      <h2>8. Exclusions de garantie et responsabilité</h2>
      <p> Le service est fourni « en l’état ». Dans toute la mesure permise par la loi, StrasDrive n’est pas responsable des dommages indirects ou consécutifs résultant de votre utilisation de la plateforme. Aucune disposition des présentes Conditions ne limite une responsabilité qui ne peut légalement être limitée. </p>

      <h2>9. Modifications</h2>
      <p> Nous pouvons mettre à jour les présentes Conditions périodiquement. Les modifications importantes seront annoncées dans l’application avant leur entrée en vigueur. En continuant à utiliser le service après ces modifications, vous acceptez les Conditions mises à jour. </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these Terms? Reach us through the{' '}
        <a href="/contact" style={{ fontWeight: 600, color: 'var(--text)' }}>page de contact</a>. </p>
    </article>
  );
}

export const Route=createFileRoute('/terms')({head:()=>({meta:[{title:"Conditions d’utilisation · StrasDrive"},{name:'description',content:"StrasDrive — conditions d’utilisation, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Conditions d’utilisation · StrasDrive"},{property:'og:description',content:"StrasDrive — conditions d’utilisation, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <PublicLayout><TermsPage/></PublicLayout>});
