import {createFileRoute} from '@tanstack/react-router';
import Link from '@/lib/archive-navigation';
import {
  Zap, ShieldCheck, Wallet, Radio, Route as RouteIcon, Car, Crown, Users,
  ArrowRight, Star, Clock, MessageCircle,
} from 'lucide-react';
import SiteHeader from '@/components/shell/SiteHeader';
import SiteFooter from '@/components/shell/SiteFooter';
import HomeRideEstimator from '@/components/home/HomeRideEstimator';



const FEATURES = [
  {
    icon: Wallet,
    title: 'Les chauffeurs conservent 90 % ou plus',
    text: 'Nous prélevons une faible commission inférieure à 10 % — juste de quoi faire fonctionner la plateforme. Le prix de la course revient à la personne au volant.',
  },
  {
    icon: Zap,
    title: 'Un chauffeur en quelques secondes',
    text: 'Notre système d’attribution par grille hexagonale trouve le chauffeur disponible le plus proche et confirme rapidement votre course.',
  },
  {
    icon: Radio,
    title: 'Suivi de course en direct',
    text: 'Suivez l’approche de votre chauffeur en temps réel, de l’acceptation à l’arrivée, mètre par mètre.',
  },
  {
    icon: RouteIcon,
    title: 'Des tarifs qui restent bas',
    text: 'Un fonctionnement optimisé pour des courses moins chères que sur les grandes applications — prix annoncés à l’avance, sans mauvaises surprises.',
  },
  {
    icon: ShieldCheck,
    title: 'Prises en charge vérifiées par code PIN',
    text: 'Chaque course commence avec votre code PIN à 4 chiffres : vous montez ainsi toujours dans le bon véhicule.',
  },
  {
    icon: MessageCircle,
    title: 'Discussion pendant la course',
    text: 'Organisez la prise en charge sans communiquer votre numéro de téléphone.',
  },
];

const TIERS = [
  { icon: Car, name: 'StrasDrive Go', text: 'Des courses au quotidien à prix avantageux' },
  { icon: Car, name: 'StrasDrive Comfort', text: 'Voitures récentes, plus d’espace pour les jambes' },
  { icon: Crown, name: 'StrasDrive Lux', text: 'Chauffeurs d’excellence, voitures haut de gamme' },
  { icon: Users, name: 'StrasDrive XL', text: 'De la place pour six personnes maximum' },
];

const STEPS = [
  { n: '01', title: 'Indiquez votre destination', text: 'Saisissez-la ou touchez la carte — les tarifs de chaque gamme s’affichent instantanément.' },
  { n: '02', title: 'Trouvez votre chauffeur', text: 'Le chauffeur le plus proche accepte et vous suivez son arrivée en direct.' },
  { n: '03', title: 'Montez et partez', text: 'Validez avec votre code PIN, profitez du trajet et payez avec votre portefeuille.' },
];

function LandingPage() {
  return (
    <div className="landing-page brand-theme">
      <SiteHeader />

      {/* ── Hero ── */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '88px 24px 72px' }}>
        <div style={{ maxWidth: 640 }}>
          <span className="eyebrow">Service VTC haut de gamme</span>
          <h1 className="display" style={{ marginTop: 14 }}> Voyagez en toute <span style={{ color: 'var(--gold-600)' }}> confiance</span>. </h1>
          <p className="muted" style={{ fontSize: '1.15rem', marginTop: 18, maxWidth: 480, lineHeight: 1.6 }}> Des tarifs annoncés à l’avance, un suivi en direct, des prises en charge vérifiées par code PIN et des chauffeurs au rendez-vous. Vos déplacements en ville, tout simplement bien faits. </p>
          <div className="flex gap-3 mt-8 wrap">
            <Link href="/signup" className="btn btn-primary btn-lg"> Réserver votre première course <ArrowRight size={18} />
            </Link>
            <Link href="/signup?role=driver" className="btn btn-secondary btn-lg"> Conduisez et gagnez </Link>
          </div>
        </div>

        <HomeRideEstimator />

        {/* Mock trip card */}
        <div
          className="card"
          style={{
            marginTop: 64, padding: 28, maxWidth: 720,
            boxShadow: 'var(--shadow-lg)', borderRadius: 'var(--radius-xl)',
          }}
        >
          <div className="flex items-center justify-between wrap gap-4">
            <div className="flex items-center gap-4">
              <span className="avatar avatar-lg" style={{ background: 'var(--ink-950)' }}>
                <Car size={22} color="#fff" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span style={{ fontWeight: 700 }}>Chauffeur en route</span>
                  <span className="badge badge-gold badge-dot">3 min</span>
                </div>
                <span className="small muted">Toyota Camry argentée · PLT 2048</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2 small muted">
                <Clock size={15} /> Trajet de 12 min </span>
              <span className="flex items-center gap-2 small muted">
                <RouteIcon size={15} /> 4,8 km </span>
              <span style={{ fontWeight: 800, fontSize: '1.2rem' }} className="mono-nums">11,20 €</span>
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--ink-100)', marginTop: 22, overflow: 'hidden' }}>
            <div style={{ width: '62%', height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--ink-900), var(--gold-600))' }} />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '72px 24px' }}>
          <span className="eyebrow">Pourquoi StrasDrive</span>
          <h2 style={{ fontSize: '2rem', marginTop: 10, maxWidth: 480 }}> Tout ce qu’une excellente course doit offrir </h2>
          <div className="grid-3 mt-8">
            {FEATURES.map(({ icon: Icon, title, text }) => ( <div key={title} className="card card-pad" style={{ background: 'var(--bg)' }}>
                <span className="avatar" style={{ background: 'var(--gold-50)', color: 'var(--gold-700)', borderRadius: 12 }}>
                  <Icon size={19} />
                </span>
                <h3 style={{ fontSize: '1.02rem', marginTop: 14 }}>{title}</h3>
                <p className="small muted mt-1" style={{ lineHeight: 1.6 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '72px 24px' }}>
        <span className="eyebrow">Comment ça marche</span>
        <h2 style={{ fontSize: '2rem', marginTop: 10 }}>Trois gestes pour aller partout</h2>
        <div className="grid-3 mt-8">
          {STEPS.map((s) => ( <div key={s.n}>
              <span style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--gold-500)', letterSpacing: '-0.03em' }}>
                {s.n}
              </span>
              <h3 style={{ fontSize: '1.05rem', marginTop: 8 }}>{s.title}</h3>
              <p className="small muted mt-1" style={{ lineHeight: 1.6, maxWidth: 280 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tiers ── */}
      <section style={{ background: 'var(--ink-950)', color: 'var(--text-invert)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '72px 24px' }}>
          <span className="eyebrow" style={{ color: 'var(--gold-500)' }}>Choisissez votre course</span>
          <h2 style={{ fontSize: '2rem', marginTop: 10 }}>Une gamme pour chaque trajet</h2>
          <div className="grid-4 mt-8">
            {TIERS.map(({ icon: Icon, name, text }) => ( <div
                key={name}
                className="card-pad"
                style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <Icon size={22} style={{ color: 'var(--gold-500)' }} />
                <h3 style={{ fontSize: '1rem', marginTop: 12 }}>{name}</h3>
                <p className="small mt-1" style={{ color: 'rgba(250,250,249,0.65)' }}>{text}</p>
              </div>
            ))}
          </div>

          <div
            className="flex items-center justify-between wrap gap-4"
            style={{ marginTop: 56, padding: 28, borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, rgba(202,138,4,0.2), rgba(202,138,4,0.05))', border: '1px solid rgba(202,138,4,0.3)' }}
          >
            <div>
              <h3 style={{ fontSize: '1.3rem' }}>Transformez votre voiture en source de revenus</h3>
              <p className="small mt-1" style={{ color: 'rgba(250,250,249,0.7)' }}> Conservez 90 % ou plus du prix de chaque course — nous ne prélevons que le coût de fonctionnement de la plateforme. Passez en ligne quand cela vous convient. </p>
            </div>
            <Link href="/signup?role=driver" className="btn btn-gold btn-lg"> Commencer à conduire <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

export const Route=createFileRoute('/')({head:()=>({meta:[{title:"Accueil · StrasDrive"},{name:'description',content:"StrasDrive — accueil, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Accueil · StrasDrive"},{property:'og:description',content:"StrasDrive — accueil, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:LandingPage});
