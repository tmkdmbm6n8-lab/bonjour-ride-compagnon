import {createFileRoute} from '@tanstack/react-router';
import PublicLayout from '@/components/PublicLayout';


function PrivacyPage() {
  return (
    <article className="prose-page">
      <h1>Politique de confidentialité</h1>
      <p className="updated">Dernière mise à jour : 12 août 2026</p>

      <p> Cette politique explique quelles données StrasDrive collecte, pourquoi nous les collectons et les choix dont vous disposez. Nous collectons uniquement les données nécessaires au fonctionnement d’une plateforme de courses sûre et fiable — aucune donnée n’est vendue aux annonceurs. </p>

      <h2>1. Les données que nous collectons</h2>
      <ul>
        <li><strong>Données de compte</strong> — nom, nom d’utilisateur et, de manière facultative, téléphone et e-mail.</li>
        <li><strong>Données de localisation</strong> — lieu de prise en charge et destination de chaque course ; les chauffeurs ne partagent leur position GPS en direct que lorsqu’ils sont en ligne ou en course.</li>
        <li><strong>Données de course</strong> — itinéraire, détail du tarif, horodatages, notes et messages échangés pendant la course.</li>
        <li><strong>Données de paiement</strong> — solde du portefeuille et registre des transactions. Nous ne conservons jamais les numéros de carte bancaire.</li>
        <li><strong>Données des chauffeurs</strong> — informations sur le véhicule et le permis nécessaires à l’approbation.</li>
      </ul>

      <h2>2. Comment nous les utilisons</h2>
      <ul>
        <li>Mettre en relation les passagers avec les chauffeurs à proximité et guider les trajets.</li>
        <li>Calculer les tarifs à l’avance, y compris la tarification liée à la demande locale.</li>
        <li>Fonctionnalités de sécurité : vérification de la prise en charge par code PIN, historiques des courses et évaluations réciproques.</li>
        <li>Assistance — résoudre les litiges et répondre à vos messages.</li>
      </ul>

      <h2>3. Ce que nous ne faisons pas</h2>
      <ul>
        <li>Nous ne vendons pas vos données personnelles.</li>
        <li>Nous ne suivons pas votre position lorsque vous n’utilisez pas l’application.</li>
        <li>Nous ne communiquons pas les numéros de téléphone des passagers aux chauffeurs — la discussion pendant la course préserve la confidentialité des coordonnées.</li>
      </ul>

      <h2>4. Partage des données</h2>
      <p> Les participants à une course voient les informations dont ils ont besoin : votre chauffeur voit votre nom, le lieu de prise en charge et votre destination ; votre passager voit votre nom, votre photo, votre véhicule et sa plaque d’immatriculation. En dehors de cela, les données ne sont partagées qu’avec les prestataires qui hébergent notre infrastructure, ou lorsque la loi l’exige. </p>

      <h2>5. Conservation</h2>
      <p> Les données des courses sont conservées tant que votre compte est actif — elles permettent d’afficher votre historique de courses, vos reçus et votre registre de revenus. Vous pouvez demander à tout moment la suppression de votre compte et des données personnelles associées via la page de contact. </p>

      <h2>6. Sécurité</h2>
      <p> Les mots de passe sont stockés sous forme d’empreintes bcrypt avec sel. Les connexions en temps réel sont authentifiées par des jetons signés à courte durée de validité. L’accès aux données de production est restreint et fait l’objet d’audits. </p>

      <h2>7. Vos choix</h2>
      <ul>
        <li>Modifiez à tout moment les informations de votre profil depuis l’application.</li>
        <li>Les chauffeurs choisissent quand ils sont visibles en passant en ligne ou hors ligne.</li>
        <li>Demandez une copie ou la suppression de vos données via la page de contact.</li>
      </ul>

      <h2>8. Contact</h2>
      <p>
        Privacy questions? Reach us through the{' '}
        <a href="/contact" style={{ fontWeight: 600, color: 'var(--text)' }}>page de contact</a>. </p>
    </article>
  );
}

export const Route=createFileRoute('/privacy')({head:()=>({meta:[{title:"Confidentialité · StrasDrive"},{name:'description',content:"StrasDrive — confidentialité, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Confidentialité · StrasDrive"},{property:'og:description',content:"StrasDrive — confidentialité, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <PublicLayout><PrivacyPage/></PublicLayout>});
