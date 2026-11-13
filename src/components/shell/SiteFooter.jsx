import Link from '@/lib/archive-navigation';
import { KovaIcon } from '@/components/brand/KovaLogo';

const COLUMNS = [
  {
    title: 'Produit',
    links: [
      { href: '/signup', label: 'Réserver une course' },
      { href: '/signup?role=driver', label: 'Devenir chauffeur' },
      { href: '/login', label: 'Se connecter' },
    ],
  },
  {
    title: 'Entreprise',
    links: [
      { href: '/contact', label: 'Nous contacter' },
      { href: '/contact#support', label: 'Assistance' },
    ],
  },
  {
    title: 'Informations légales',
    links: [
      { href: '/terms', label: 'Conditions d’utilisation' },
      { href: '/privacy', label: 'Politique de confidentialité' },
      { href: '/mentions-legales', label: 'Mentions légales' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '48px 24px 32px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 1.4fr) repeat(3, minmax(140px, 1fr))',
            gap: 32,
          }}
          className="footer-grid"
        >
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <KovaIcon size={30} />
              <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}> StrasDrive </span>
            </span>
            <p className="small muted mt-3" style={{ maxWidth: 260, lineHeight: 1.6 }}> Un service VTC haut de gamme avec tarifs annoncés à l’avance, suivi en direct et prises en charge vérifiées par code PIN. Déplacez-vous en toute sérénité. </p>
          </div>

          {COLUMNS.map((col) => ( <div key={col.title}>
              <h4
                className="tiny"
                style={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-3)',
                  marginBottom: 14,
                }}
              >
                {col.title}
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map((l) => ( <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="small"
                      style={{ color: 'var(--text-2)', transition: 'color 150ms' }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="flex items-center justify-between wrap gap-3"
          style={{ borderTop: '1px solid var(--border)', marginTop: 40, paddingTop: 20 }}
        >
          <span className="tiny muted">© {new Date().getFullYear()} StrasDrive. Tous droits réservés.</span>
          <div className="flex gap-4 tiny muted">
            <Link href="/terms">Conditions</Link>
            <Link href="/privacy">Confidentialité</Link>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
