import {apiFetch as fetch} from '@/lib/archive-fetch';
import {createFileRoute} from '@tanstack/react-router';
'use client';

import { useState, Suspense } from 'react';
import Link from '@/lib/archive-navigation';
import { useSearchParams } from '@/lib/archive-navigation';
import { signIn } from '@/lib/archive-auth';
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { KovaLogo } from '@/components/brand/KovaLogo';
import LegalFooter from '@/components/shell/LegalFooter';

function LoginForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    const res = await signIn('credentials', {
      username: username.trim(),
      password,
      redirect: false,
    });

    if (res?.error) {
      setError(
        res.status === 429
          ? 'Trop de tentatives de connexion — veuillez patienter quelques minutes et réessayer.'
          : 'E-mail ou mot de passe incorrect'
      );
      setLoading(false);
      return;
    }

    // Full navigation so the proxy routes by role (rider/driver/admin)
    const callbackUrl = searchParams.get('callbackUrl');
    const me = await fetch('/api/users/me'); const account = await me.json();
    window.location.href = callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : account.user?.role === 'driver' ? '/driver/dashboard' : account.user?.role === 'admin' ? '/admin/dashboard' : '/dashboard';
  }

  return (
    <div className="auth-page">
      <div className="auth-card animate-in">
        <div className="flex justify-center mb-6">
          <Link href="/" aria-label="Accueil StrasDrive">
            <KovaLogo size={38} />
          </Link>
        </div>

        <h1 className="text-center" style={{ fontSize: '1.5rem' }}> Heureux de vous revoir </h1>
        <p className="text-center muted small mt-1 mb-6"> Connectez-vous pour poursuivre votre voyage </p>

        <form onSubmit={handleSubmit} className="flex-col gap-4">
          <div className="field">
            <label htmlFor="username">E-mail</label>
            <div className="input-wrap">
              <User size={17} />
              <input
                id="username"
                type="email"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="vous@exemple.fr"
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <div className="input-wrap" style={{ position: 'relative' }}>
              <Lock size={17} />
              <input
                id="password"
                className="input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                style={{ paddingRight: 46 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: 10,
                  color: 'var(--ink-400)',
                }}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && <p className="input-error-msg">{error}</p>}

          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? <span className="spinner" /> : (
              <> Se connecter <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="text-center small muted mt-6">
          New to Kova?{' '}
          <Link href="/signup" style={{ fontWeight: 600, color: 'var(--text)' }}> Créer un compte </Link>
        </p>

        <LegalFooter className="mt-6" />
      </div>
    </div>
  );
}

function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

export const Route=createFileRoute('/login')({head:()=>({meta:[{title:"Connexion · StrasDrive"},{name:'description',content:"StrasDrive — connexion, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Connexion · StrasDrive"},{property:'og:description',content:"StrasDrive — connexion, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:LoginPage});
