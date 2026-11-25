import CloseControl from "@/components/ui/CloseControl";
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
import { lovable } from '@/integrations/lovable/index';

function LoginCloseLink() {
  return <CloseControl href="/" className="signup-close" label="Fermer la connexion" title="Retour à l’accueil" />;
}

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
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/login` });
      const oauthError = result.error;
      if (result.redirected) return;
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
      // Do not label every server/configuration failure as a wrong password.
      // Keep credential errors generic to avoid disclosing account existence.
      const status = Number(res.status || 0);
      const rawMessage = typeof res.error === "string" ? res.error : res.error?.message || "";
      console.error("[login] Authentication failed", { status, message: rawMessage });
      setError(
        status === 429
          ? "Trop de tentatives de connexion — veuillez patienter quelques minutes et réessayer."
          : status === 400 || status === 401
            ? "Adresse e-mail ou mot de passe incorrect. Vérifiez vos informations et réessayez. Si vous avez oublié votre mot de passe, utilisez le lien ci-dessous pour le réinitialiser."
            : status === 403
              ? "Connexion refusée. Vérifiez l’état de votre compte ou contactez l’assistance."
            : status >= 500
              ? "Le service de connexion rencontre un problème technique. Réessayez plus tard."
              : status === 0
                ? "Connexion impossible : vérifiez le réseau ou la configuration du service d'authentification."
                : "Connexion impossible (erreur " + status + "). Veuillez réessayer.",
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
      <div className="auth-card login-card animate-in signup-dismissible">
        <LoginCloseLink />
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

        <a href="/contact?topic=fleet_application" className="btn btn-secondary btn-full mb-4">
          Sociétés VTC
        </a>

        {searchParams.get("suspended") && (
          <div className="small text-center mb-4" role="alert" style={{ color: "#f87171", fontWeight: 600 }}>
            Votre accès chauffeur est suspendu. Vous avez été déconnecté de cet appareil.
            <Link href="/contact?topic=driver_support" className="block mt-2">Contacter l’assistance</Link>
          </div>
        )}
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#000000" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.66-.82 1.11-1.96.99-3.1-.96.04-2.12.64-2.8 1.44-.6.69-1.12 1.83-.98 2.94 1.07.08 2.14-.54 2.79-1.28" />
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
