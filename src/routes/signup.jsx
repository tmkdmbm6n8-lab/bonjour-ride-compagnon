import CloseControl from "@/components/ui/CloseControl";
import {createFileRoute} from '@tanstack/react-router';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from '@/lib/archive-navigation';
import { useSearchParams, useRouter } from '@/lib/archive-navigation';
import { signIn, useSession } from '@/lib/archive-auth';
import { User, AtSign, Lock, ArrowRight, Car, Navigation, MailCheck, ExternalLink } from 'lucide-react';
import { KovaLogo } from '@/components/brand/KovaLogo';
import LegalFooter from '@/components/shell/LegalFooter';
import { REQUIRED_DOCUMENTS } from '@/lib/vtc-documents';

function SignupCloseLink() {
  return <CloseControl href="/" className="signup-close" label="Fermer l’inscription" title="Retour à l’accueil" />;
}

function SignupForm() {
  const router = useRouter();
  const { update } = useSession();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: searchParams.get('role') === 'driver' ? 'driver' : 'rider',
    acceptTerms: false,
  });
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const confirmationTitle = useRef(null);
  useEffect(() => {
    if (confirmationEmail) confirmationTitle.current?.focus();
  }, [confirmationEmail]);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setFieldError('');

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setFieldError('confirmPassword');
      return;
    }
    if (!form.acceptTerms) {
      setError('Vous devez accepter les conditions d’utilisation pour créer un compte');
      setFieldError('acceptTerms');
      return;
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      setFieldError('password');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Impossible de créer le compte');
        setFieldError(data.field || '');
        setLoading(false);
        return;
      }

      if (data.needsConfirmation) {
        setConfirmationEmail(form.email.trim());
        setForm((current) => ({ ...current, password: '', confirmPassword: '' }));
        setLoading(false);
        return;
      }
      // Sign in once confirmed
      const login = await signIn('credentials', {
        username: form.email.trim(),
        password: form.password,
        redirect: false,
      });

      const callbackUrl = searchParams.get('callbackUrl');
      const safeCallback = callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : null;
      if (login?.error) {
        await router.push(safeCallback ? `/login?callbackUrl=${encodeURIComponent(safeCallback)}` : '/login');
        return;
      }
      await update();
      await router.push(safeCallback || (form.role === 'driver' ? '/driver/dashboard' : '/dashboard'));
    } catch {
      setError('Une erreur est survenue — veuillez réessayer');
      setLoading(false);
    }
  }

  if (confirmationEmail) {
    const domain = confirmationEmail.split('@')[1]?.toLowerCase();
    const mailbox = {
      'gmail.com': 'https://mail.google.com/',
      'googlemail.com': 'https://mail.google.com/',
      'outlook.com': 'https://outlook.live.com/mail/',
      'outlook.fr': 'https://outlook.live.com/mail/',
      'hotmail.com': 'https://outlook.live.com/mail/',
      'hotmail.fr': 'https://outlook.live.com/mail/',
      'live.com': 'https://outlook.live.com/mail/',
      'live.fr': 'https://outlook.live.com/mail/',
      'yahoo.com': 'https://mail.yahoo.com/',
      'yahoo.fr': 'https://mail.yahoo.com/',
      'icloud.com': 'https://www.icloud.com/mail',
      'me.com': 'https://www.icloud.com/mail',
      'orange.fr': 'https://mail.orange.fr/',
      'wanadoo.fr': 'https://mail.orange.fr/',
    }[domain];
    return (
      <div className="auth-page brand-theme">
        <div className="auth-card animate-in signup-confirmation signup-dismissible">
          <SignupCloseLink />
          <Link href="/" aria-label="Accueil StrasDrive"><KovaLogo size={38} /></Link>
          <div className="confirmation-icon"><MailCheck size={32} aria-hidden="true" /></div>
          <p className="eyebrow" role="status">Inscription réussie</p>
          <h1 ref={confirmationTitle} tabIndex={-1} className="mt-3">Vérifiez votre adresse email</h1>
          <p className="muted small mt-4">Un lien de confirmation a été envoyé à <strong className="confirmation-email">{confirmationEmail}</strong>.</p>
          <p className="muted small mt-3">Ouvrez cet email et cliquez sur le lien pour activer votre compte. Vous pourrez ensuite vous connecter et commencer à utiliser StrasDrive.</p>
          {mailbox && <a href={mailbox} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg btn-full mt-6">Ouvrir ma messagerie <ExternalLink size={18} /></a>}
          <Link href="/login" className={`btn ${mailbox ? 'btn-secondary' : 'btn-primary'} btn-lg btn-full mt-3`}>Se connecter après confirmation <ArrowRight size={18} /></Link>
          <p className="tiny muted mt-6">Vous ne trouvez pas l’email ? Vérifiez les courriers indésirables et assurez-vous de consulter la boîte correspondant à l’adresse ci-dessus.</p>
          <LegalFooter className="mt-6" />
        </div>
      </div>
    );
  }

  const roleCard = (role, Icon, title, sub) => ( <button
      type="button"
      onClick={() => setForm((f) => ({ ...f, role }))}
      className="card card-pad"
      style={{
        flex: 1,
        textAlign: 'left',
        cursor: 'pointer',
        borderColor: form.role === role ? 'var(--ink-950)' : 'var(--border)',
        borderWidth: 1.5,
        background: form.role === role ? 'var(--ink-50)' : 'var(--surface)',
        transition: 'border-color 150ms, background 150ms',
        padding: 14,
      }}
      aria-pressed={form.role === role}
    >
      <Icon size={20} style={{ color: form.role === role ? 'var(--gold-600)' : 'var(--ink-400)' }} />
      <div className="small mt-2" style={{ fontWeight: 700 }}>{title}</div>
      <div className="tiny muted">{sub}</div>
    </button>
  );

  return (
    <div className="auth-page brand-theme">
      <div className="auth-card animate-in signup-dismissible">
        <SignupCloseLink />
        <div className="flex justify-center mb-6">
          <Link href="/" aria-label="Accueil StrasDrive">
            <KovaLogo size={38} />
          </Link>
        </div>

        <h1 className="text-center" style={{ fontSize: '1.5rem' }}> Créez votre compte </h1>
        <p className="text-center muted small mt-1 mb-6">Inscription gratuite, prêt en quelques secondes</p>

        <form onSubmit={handleSubmit} className="flex-col gap-4">
          <div className="flex gap-3">
            {roleCard('rider', Navigation, 'Voyager', 'Réservez des courses en ville')}
            {roleCard('driver', Car, 'Conduire', 'Gagnez de l’argent à votre rythme')}
          </div>

          {form.role === 'driver' && (
            <div className="card card-pad tiny" style={{ background: 'var(--gold-50)', borderColor: 'var(--gold-200, var(--border))' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Documents à fournir après l’inscription (obligatoires en France)</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {REQUIRED_DOCUMENTS.map((d) => <li key={d.type}>{d.label}</li>)}
              </ul>
              <div className="muted mt-1">Votre compte chauffeur est activé une fois ces documents vérifiés par StrasDrive.</div>
            </div>
          )}

          <div className="field">
            <label htmlFor="name">Nom complet</label>
            <div className="input-wrap">
              <User size={17} />
              <input
                id="name"
                className="input"
                value={form.name}
                onChange={set('name')}
                placeholder="Alex Morgan"
                autoComplete="name"
                required
                minLength={2}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="username">Nom d’utilisateur</label>
            <div className="input-wrap">
              <AtSign size={17} />
              <input
                id="username"
                className={`input ${fieldError === 'username' ? 'has-error' : ''}`}
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''),
                  }))
                }
                placeholder="alexmorgan"
                autoComplete="username"
                required
                minLength={3}
                maxLength={30}
              />
            </div>
          </div>

          <div className="field"><label htmlFor="email">E-mail</label><input id="email" className="input" type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <div className="input-wrap">
              <Lock size={17} />
              <input
                id="password"
                className={`input ${fieldError === 'password' ? 'has-error' : ''}`}
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="Au moins 8 caractères"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
            <div className="input-wrap">
              <Lock size={17} />
              <input
                id="confirmPassword"
                className={`input ${fieldError === 'confirmPassword' ? 'has-error' : ''}`}
                type="password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                placeholder="Saisissez à nouveau votre mot de passe"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {error && <p className="input-error-msg">{error}</p>}

          <label htmlFor="acceptTerms" className="tiny muted flex gap-2" style={{ lineHeight: 1.6, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              id="acceptTerms"
              type="checkbox"
              checked={form.acceptTerms}
              onChange={(e) => setForm((f) => ({ ...f, acceptTerms: e.target.checked }))}
              required
              style={{ marginTop: 3, accentColor: 'var(--ink-950)', flexShrink: 0 }}
            />
            <span>
              J’accepte les{' '}
              <Link href="/terms" style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'underline' }}>Conditions d’utilisation</Link>{' '}
              et j’ai lu la{' '}
              <Link href="/privacy" style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'underline' }}>Politique de confidentialité</Link>, qui explique comment mes données sont utilisées.
            </span>
          </label>

          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? <span className="spinner" /> : (
              <> Créer un compte <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="text-center small muted mt-6">
          Vous avez déjà un compte ?{' '}
          <Link href="/login" style={{ fontWeight: 600, color: 'var(--text)' }}> Se connecter </Link>
        </p>

        <LegalFooter className="mt-6" />
      </div>
    </div>
  );
}

function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

export const Route=createFileRoute('/signup')({head:()=>({meta:[{title:"Inscription · StrasDrive"},{name:'description',content:"StrasDrive — inscription, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Inscription · StrasDrive"},{property:'og:description',content:"StrasDrive — inscription, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:SignupPage});
