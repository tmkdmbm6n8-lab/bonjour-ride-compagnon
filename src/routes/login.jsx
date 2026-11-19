import { apiFetch as fetch } from "@/lib/archive-fetch";
import { createFileRoute } from "@tanstack/react-router";
("use client");

import { useState, useEffect, Suspense } from "react";
import Link from "@/lib/archive-navigation";
import { useSearchParams, useRouter } from "@/lib/archive-navigation";
import { signIn, useSession } from "@/lib/archive-auth";
import { User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { KovaLogo } from "@/components/brand/KovaLogo";
import LegalFooter from "@/components/shell/LegalFooter";
import { supabase } from "@/integrations/supabase/client";

function LoginForm() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState("");

  // Redirection automatique dès que l'utilisateur est authentifié (notamment au retour d'Apple ou Google)
  useEffect(() => {
    if (session?.user) {
      const callbackUrl = searchParams.get("callbackUrl");
      const safeCallback =
        callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : null;
      const target =
        safeCallback ||
        (session.user.role === "driver"
          ? "/driver/dashboard"
          : session.user.role === "admin"
            ? "/admin/dashboard"
            : "/dashboard");
      router.push(target);
    }
  }, [session, router, searchParams]);

  async function handleOAuth(provider) {
    if (loading || oauthLoading) return;
    setError("");
    setOauthLoading(provider);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      });
      if (oauthError) {
        setError(oauthError.message || `Erreur de connexion avec ${provider}`);
        setOauthLoading("");
      }
    } catch {
      setError("Impossible de joindre le service de connexion");
      setOauthLoading("");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      username: username.trim(),
      password,
      redirect: false,
    });

    if (res?.error) {
      setError(
        res.status === 429
          ? "Trop de tentatives de connexion — veuillez patienter quelques minutes et réessayer."
          : "E-mail ou mot de passe incorrect",
      );
      setLoading(false);
      return;
    }

    const callbackUrl = searchParams.get("callbackUrl");
    const me = await fetch("/api/users/me");
    const account = await me.json();
    await update();
    await router.push(
      callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
        ? callbackUrl
        : account.user?.role === "driver"
          ? "/driver/dashboard"
          : account.user?.role === "admin"
            ? "/admin/dashboard"
            : "/dashboard",
    );
  }

  return (
    <div className="auth-page login-page brand-theme">
      <div className="auth-card login-card animate-in">
        <div className="flex justify-center mb-6">
          <Link href="/" aria-label="Accueil StrasDrive">
            <KovaLogo size={38} />
          </Link>
        </div>

        <h1 className="text-center" style={{ fontSize: "1.5rem" }}>
          {" "}
          Heureux de vous revoir{" "}
        </h1>
        <p className="text-center muted small mt-1 mb-6"> Connectez-vous pour poursuivre votre voyage </p>

        {searchParams.get("expired") && (
          <p className="small text-center mb-4" role="status" style={{ color: "var(--gold-700)", fontWeight: 600 }}>
            Votre session a expiré (déconnexion sur un autre appareil ou connexion trop ancienne). Reconnectez-vous pour
            continuer.
          </p>
        )}
        {/* Boutons de connexion sociale : Google & Apple */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <button
            type="button"
            className="btn btn-secondary btn-full flex items-center justify-center gap-3"
            onClick={() => handleOAuth("google")}
            disabled={loading || Boolean(oauthLoading)}
            style={{ minHeight: 46, fontSize: "0.92rem", fontWeight: 600, borderRadius: 12 }}
          >
            {oauthLoading === "google" ? (
              <span className="spinner" />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>Continuer avec Google</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-full flex items-center justify-center gap-3"
            onClick={() => handleOAuth("apple")}
            disabled={loading || Boolean(oauthLoading)}
            style={{
              minHeight: 46,
              background: "#ffffff",
              color: "#000000",
              border: "none",
              fontSize: "0.92rem",
              fontWeight: 600,
              borderRadius: 12,
            }}
          >
            {oauthLoading === "apple" ? (
              <span className="spinner" style={{ borderColor: "#000000", borderTopColor: "transparent" }} />
            ) : (
              <>
                <svg width="17" height="17" viewBox="0 0 170 170" fill="#000000" aria-hidden="true">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.07-7.6-7.85-11.7-14.34-6.8-10.77-12.02-23.36-15.66-37.77-3.64-14.41-5.46-27.42-5.46-39.02 0-14.41 3.58-26.44 10.74-36.08 7.16-9.65 16.42-14.6 27.78-14.86 4.98 0 10.51 1.25 16.59 3.76 6.08 2.5 9.9 3.81 11.46 3.93 1.96-.25 5.99-1.64 12.09-4.18 6.1-2.54 11.45-3.69 16.05-3.47 11.85.64 21.43 4.88 28.74 12.71-10.37 6.27-15.42 15.11-15.15 26.52.27 8.94 3.65 16.56 10.14 22.86 6.49 6.3 14.15 9.87 22.98 10.71-2.22 6.52-4.8 12.72-7.74 18.6zM119.22 31.84c0-7.39 2.65-14.28 7.95-20.67 5.3-6.39 11.83-10.22 19.59-11.48.33 1.54.49 3.01.49 4.41 0 7.4-2.73 14.38-8.19 20.94-5.46 6.56-12.08 10.4-19.84 11.53V31.84z" />
                </svg>
                <span>Continuer avec Apple</span>
              </>
            )}
          </button>
        </div>

        {/* Séparateur */}
        <div className="flex items-center gap-3 my-4">
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
            ou avec e-mail
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

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
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <div className="input-wrap" style={{ position: "relative" }}>
              <Lock size={17} />
              <input
                id="password"
                className="input"
                type={showPassword ? "text" : "password"}
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
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  padding: 10,
                  color: "var(--ink-400)",
                }}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && <p className="input-error-msg">{error}</p>}

          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading || Boolean(oauthLoading)}>
            {loading ? (
              <span className="spinner" />
            ) : (
              <>
                {" "}
                Se connecter <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        <Link href="/recover-account" className="btn btn-ghost btn-full mt-3">
          Mot de passe oublié ou e-mail non reçu ?
        </Link>

        <p className="text-center small muted mt-6">
          Vous découvrez StrasDrive ?{" "}
          <Link href="/signup" style={{ fontWeight: 600, color: "var(--text)" }}>
            {" "}
            Créer un compte{" "}
          </Link>
        </p>

        <LegalFooter className="login-legal mt-6" />
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

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion · StrasDrive" },
      { name: "description", content: "StrasDrive — connexion, service de mise en relation VTC et tarifs en euros." },
      { property: "og:title", content: "Connexion · StrasDrive" },
      {
        property: "og:description",
        content: "StrasDrive — connexion, service de mise en relation VTC et tarifs en euros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});
