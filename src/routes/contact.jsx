import { useState } from 'react';
import { apiFetch } from '@/lib/archive-fetch';
import { useSearchParams } from '@/lib/archive-navigation';
import {createFileRoute} from '@tanstack/react-router';
import PublicLayout from '@/components/PublicLayout';
import { Mail, MessageSquare, LifeBuoy } from 'lucide-react';
import { KovaLogo } from "@/components/brand/KovaLogo";
import FleetWorkspace from "@/components/FleetWorkspace";
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

function FleetPage() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (status !== "idle") return;
    const form = new FormData(event.currentTarget);
    const field = (name) => String(form.get(name) || "").trim();
    const company = field("legalName");
    const siret = field("siret").replace(/\s/g, "");
    const name = field("name");
    const email = field("email");
    if (company.length < 2 || name.length < 2 || !/^\d{14}$/.test(siret)) {
      setError("Vérifiez le nom de la société, le contact et le SIRET à 14 chiffres.");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const response = await apiFetch("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          topic: "fleet_application",
          name,
          email,
          company: field("company"),
          message: [
            `Société : ${company}`,
            `SIRET : ${siret}`,
            `Nombre de véhicules : ${field("vehicles")}`,
            field("details"),
          ].filter(Boolean).join("\n"),
        }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true)
        throw new Error(result.error || "Impossible d’envoyer la demande.");
      setStatus("sent");
    } catch (err) {
      setError(err.message || "Impossible d’envoyer la demande.");
      setStatus("idle");
    }
  }

  return (
    <div className="auth-page brand-theme">
      <div className="auth-card animate-in">
        <div className="flex justify-center mb-6"><a href="/" aria-label="Accueil StrasDrive"><KovaLogo size={38} /></a></div>
        <h1 className="text-center" style={{ fontSize: "1.5rem" }}>Sociétés VTC</h1>
        <p className="text-center small muted mt-1 mb-6">Vous exploitez un véhicule ou une flotte ? Présentez votre société pour rejoindre le programme pilote StrasDrive.</p>
        <section id="demande-societe" aria-labelledby="fleet-request-title">
          <h2 id="fleet-request-title">Demande d’inscription</h2>
          {status === "sent" ? (
            <p role="status">Votre demande a été transmise. L’équipe StrasDrive vous recontactera par e-mail.</p>
          ) : (
            <>
              <p className="small muted">L’équipe examine votre demande et vous contacte pour la suite du parcours.</p>
              <form onSubmit={submit} className="flex-col gap-3 mt-4">
                <label className="field">Raison sociale
                  <input className="input" name="legalName" autoComplete="organization" minLength={2} maxLength={150} required />
                </label>
                <label className="field">SIRET
                  <input className="input" name="siret" inputMode="numeric" maxLength={20} required />
                </label>
                <label className="field">Nom du contact
                  <input className="input" name="name" autoComplete="name" minLength={2} maxLength={100} required />
                </label>
                <label className="field">E-mail professionnel
                  <input className="input" name="email" type="email" autoComplete="email" maxLength={254} required />
                </label>
                <label className="field">Nombre de véhicules
                  <input className="input" name="vehicles" type="number" min={1} max={10000} step={1} required />
                </label>
                <label className="field">Précisions (facultatif)
                  <textarea className="input" name="details" maxLength={1200} rows={3} />
                </label>
                <div hidden aria-hidden="true">
                  <label>Laisser vide <input name="company" tabIndex={-1} autoComplete="off" /></label>
                </div>
                {error && <p role="alert" className="input-error-msg">{error}</p>}
                <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={status === "sending"}>
                  {status === "sending" ? "Envoi…" : "Envoyer ma demande"}
                </button>
                <a href="/privacy" className="small">Politique de confidentialité</a>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ContactRoute() {
  const params = useSearchParams();
  if (params.get('topic') === 'fleet') return <FleetWorkspace />;
  if (params.get('topic') === 'fleet_application') {
    return (
      <div className="landing-page brand-theme">
        <PublicLayout><FleetPage /></PublicLayout>
      </div>
    );
  }
  return <PublicLayout><ContactPage /></PublicLayout>;
}

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

export const Route=createFileRoute('/contact')({head:()=>({meta:[{title:"Contact · StrasDrive"},{name:'description',content:"StrasDrive — contact, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Contact · StrasDrive"},{property:'og:description',content:"StrasDrive — contact, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:ContactRoute});
