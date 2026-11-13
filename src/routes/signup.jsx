import {createFileRoute} from '@tanstack/react-router';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useState, Suspense } from 'react';
import Link from '@/lib/archive-navigation';
import { useSearchParams } from '@/lib/archive-navigation';
import { signIn } from '@/lib/archive-auth';
import { User, AtSign, Lock, ArrowRight, Car, Navigation } from 'lucide-react';
import { KovaLogo } from '@/components/brand/KovaLogo';
import LegalFooter from '@/components/shell/LegalFooter';

function SignupForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: searchParams.get('role') === 'driver' ? 'driver' : 'rider',
  });
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

      if (data.needsConfirmation) { setError('Consultez votre e-mail pour confirmer votre compte, puis connectez-vous.'); setLoading(false); return; }
      // Sign in once confirmed
      const login = await signIn('credentials', {
        username: form.email.trim(),
        password: form.password,
        redirect: false,
      });

      if (login?.error) {
        window.location.href = '/login';
        return;
      }
      window.location.href = form.role === 'driver' ? '/driver/dashboard' : '/dashboard';
    } catch {
      setError('Une erreur est survenue — veuillez réessayer');
      setLoading(false);
    }
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
    <div className="auth-page">
      <div className="auth-card animate-in">
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

          <p className="tiny muted text-center" style={{ lineHeight: 1.6 }}>
            En créant un compte, vous acceptez nos{' '}
            <Link href="/terms" style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'underline' }}> Conditions d’utilisation </Link>{' '}
            et{' '}
            <Link href="/privacy" style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'underline' }}> Politique de confidentialité </Link> . </p>

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
