import {createFileRoute} from '@tanstack/react-router';
import PublicLayout from '@/components/PublicLayout';
import {COMPANY, HOST, LEGAL_UPDATED_LABEL} from '@/lib/legal';

const linkStyle = { fontWeight: 600, color: 'var(--text)' };

function LegalNoticePage() {
  return (
    <article className="prose-page">
      <h1>Mentions légales</h1>
      <p className="updated">Dernière mise à jour : {LEGAL_UPDATED_LABEL}</p>

      <p> Conformément à l’article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN), voici les informations relatives à l’éditeur et à l’hébergeur du site et de l’application StrasDrive. </p>

      <h2>1. Éditeur</h2>
      <ul>
        <li><strong>Nom commercial</strong> — {COMPANY.brand}</li>
        <li><strong>Raison sociale</strong> — {COMPANY.legalName}</li>
        <li><strong>Forme juridique et capital</strong> — {COMPANY.legalForm}</li>
        <li><strong>Siège social</strong> — {COMPANY.address}</li>
        <li><strong>Immatriculation</strong> — {COMPANY.registration}</li>
        <li><strong>TVA intracommunautaire</strong> — {COMPANY.vat}</li>
        <li><strong>Téléphone</strong> — {COMPANY.phone}</li>
        <li><strong>E-mail</strong> — {COMPANY.email}</li>
        <li><strong>Directeur de la publication</strong> — {COMPANY.publicationDirector}</li>
      </ul>

      <h2>2. Activité réglementée</h2>
      <p> StrasDrive exploite une centrale de réservation de voitures de transport avec chauffeur (VTC) au sens des articles L3142-1 et suivants du Code des transports. Elle met en relation des passagers avec des chauffeurs VTC indépendants et ne réalise pas elle-même le transport. </p>
      <ul>
        <li><strong>Déclaration de centrale de réservation</strong> — {COMPANY.transportRegistration}</li>
        <li>Chaque chauffeur doit être titulaire de la carte professionnelle VTC, inscrit au registre des exploitants VTC et assuré pour le transport de personnes à titre onéreux.</li>
      </ul>

      <h2>3. Hébergeur</h2>
      <ul>
        <li><strong>{HOST.name}</strong></li>
        <li>{HOST.address}</li>
        <li><a href={HOST.website} style={linkStyle} target="_blank" rel="noreferrer">{HOST.website.replace('https://', '')}</a></li>
      </ul>

      <h2>4. Médiation de la consommation</h2>
      <p> Conformément aux articles L611-1 et suivants du Code de la consommation, en cas de litige non résolu avec notre service client, vous pouvez recourir gratuitement au médiateur de la consommation suivant : {COMPANY.mediator}. </p>

      <h2>5. Données personnelles</h2>
      <p> Le traitement de vos données est décrit dans notre{' '}
        <a href="/privacy" style={linkStyle}>politique de confidentialité</a>. Contact données personnelles : {COMPANY.dpoEmail}. Vous pouvez aussi saisir la CNIL (<a href="https://www.cnil.fr" style={linkStyle} target="_blank" rel="noreferrer">cnil.fr</a>). </p>

      <h2>6. Propriété intellectuelle</h2>
      <p> La marque StrasDrive, les textes, le logo et l’interface du service sont protégés. Toute reproduction sans autorisation est interdite. Les fonds de carte sont fournis par © les contributeurs d’OpenStreetMap, sous licence ODbL (<a href="https://www.openstreetmap.org/copyright" style={linkStyle} target="_blank" rel="noreferrer">openstreetmap.org/copyright</a>). </p>

      <h2>7. Contact</h2>
      <p> Pour toute question, écrivez-nous via la{' '}
        <a href="/contact" style={linkStyle}>page de contact</a>. </p>
    </article>
  );
}

export const Route=createFileRoute('/mentions-legales')({head:()=>({meta:[{title:"Mentions légales · StrasDrive"},{name:'description',content:"Mentions légales de StrasDrive : éditeur, hébergeur, centrale de réservation VTC et médiation de la consommation."},{property:'og:title',content:"Mentions légales · StrasDrive"},{property:'og:description',content:"Éditeur, hébergeur, activité VTC réglementée et médiation de la consommation de StrasDrive."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <PublicLayout><LegalNoticePage/></PublicLayout>});
