import { useSearchParams } from '@/lib/archive-navigation';
import {createFileRoute} from '@tanstack/react-router';
import PublicLayout from '@/components/PublicLayout';
import { Mail, MessageSquare, LifeBuoy } from 'lucide-react';
import ContactForm from '@/components/ContactForm';



const CHANNELS = [
  {
    icon: LifeBuoy,
    title: 'Assistance courses et trajets',
    text: 'Un problème de trajet, de tarif ou de chauffeur ? Indiquez la date de la course pour que nous la retrouvions rapidement.',
  },
  {
    icon: Mail,
    title: 'Assistance chauffeurs',
    text: 'Questions de nos chauffeurs partenaires sur l’inscription, l’approbation, les revenus et les versements.',
  },
  {
    icon: MessageSquare,
    title: 'Autres demandes',
    text: 'Presse, partenariats, demandes de données ou simples avis — nous lisons tous vos messages.',
  },
];

function ContactPage() {
  const params = useSearchParams();
  const topic = ['ride_issue','payments','safety','driver_support','data_request'].includes(params.get('topic')) ? params.get('topic') : 'general';
  const rideId = (params.get('ride') || '').slice(0,80).replace(/[^a-zA-Z0-9-]/g,'');
  const context = rideId ? `Référence de course : ${rideId}\n\nDécrivez votre demande : ` : '';
  return (
    <div className="prose-page" style={{ maxWidth: 920 }}>
      <h1>Nous contacter</h1>
      <p className="updated" id="support"> Nous répondons généralement sous un jour ouvré. </p>

      <div className="grid-3 mb-6">
        {CHANNELS.map(({ icon: Icon, title, text }) => ( <div key={title} className="card card-pad">
            <Icon size={20} style={{ color: 'var(--gold-700)' }} />
            <h3 style={{ fontSize: '0.98rem', marginTop: 10 }}>{title}</h3>
            <p className="tiny muted mt-1" style={{ lineHeight: 1.6 }}>{text}</p>
          </div>
        ))}
      </div>

      <div className="card card-pad" style={{ maxWidth: 640 }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: 16 }}>Envoyez-nous un message</h2>
        <ContactForm key={`${topic}:${rideId}`} initialTopic={topic} initialMessage={context}/>
      </div>
    </div>
  );
}

export const Route=createFileRoute('/contact')({head:()=>({meta:[{title:"Contact · StrasDrive"},{name:'description',content:"StrasDrive — contact, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Contact · StrasDrive"},{property:'og:description',content:"StrasDrive — contact, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <PublicLayout><ContactPage/></PublicLayout>});
