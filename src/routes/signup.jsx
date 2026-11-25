import CloseControl from "@/components/ui/CloseControl";
import { createFileRoute } from "@tanstack/react-router";
import { apiFetch as fetch } from "@/lib/archive-fetch";
("use client");

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "@/lib/archive-navigation";
import { useSearchParams, useRouter } from "@/lib/archive-navigation";
import { signIn, useSession } from "@/lib/archive-auth";
import { User, AtSign, Lock, ArrowRight, Car, Navigation, MailCheck, ExternalLink } from "lucide-react";
import { KovaLogo } from "@/components/brand/KovaLogo";
import LegalFooter from "@/components/shell/LegalFooter";
import { REQUIRED_DOCUMENTS } from "@/lib/vtc-documents";
import { lovable } from "@/integrations/lovable";

function SignupCloseLink() {
  return <CloseControl href="/" className="signup-close" label="Fermer l’inscription" title="Retour à l’accueil" />;
}

// Génération automatique d'un identifiant à partir du nom complet
function generateUsername(fullName) {
  if (!fullName || typeof fullName !== "string") {
    return `user_${Math.floor(1000 + Math.random() * 9000)}`;
  }
  const clean = fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents (é -> e, etc.)
    .replace(/[^a-z0-9]/g, ""); // ne garde que les lettres et chiffres

  return clean ? clean.slice(0, 24) : `user_${Math.floor(1000 + Math.random() * 9000)}`;
}

function SignupForm() {
  const router = useRouter();
  const { update, data: session } = useSession();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: searchParams.get("role") === "driver" ? "driver" : "rider",
    acceptTerms: false,
  });

  const [confirmationEmail, setConfirmationEmail] = useState("");
  const confirmationTitle = useRef(null);

  useEffect(() => {
    if (confirmationEmail) confirmationTitle.current?.focus();
  }, [confirmationEmail]);

  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState("");

  // Redirection automatique dès qu'une session OAuth est active
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

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleOAuth(provider) {
    if (loading || oauthLoading) return;
    setError("");
    setOauthLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/signup`,
      });
      const oauthError = result.error;
      if (result.redirected) return;
      if (oauthError) {
        setError(oauthError.message || `Erreur d’inscription avec ${provider}`);
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
    setFieldError("");

    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      setFieldError("confirmPassword");
      return;
    }
    if (!form.acceptTerms) {
      setError("Vous devez accepter les conditions d’utilisation pour créer un compte");
      setFieldError("acceptTerms");
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      setFieldError("password");
      return;
    }

    setLoading(true);

    try {
      const autoUsername = generateUsername(form.name);
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          username: autoUsername,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Impossible de créer le compte");
        setFieldError(data.field || "");
        setLoading(false);
        return;
      }

      if (data.needsConfirmation) {
        setConfirmationEmail(form.email.trim());
        setForm((current) => ({ ...current, password: "", confirmPassword: "" }));
        setLoading(false);
        return;
      }

      const login = await signIn("credentials", {
        username: form.email.trim(),
        password: form.password,
        redirect: false,
      });

      const callbackUrl = searchParams.get("callbackUrl");
      const safeCallback =
        callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : null;
      if (login?.error) {
        await router.push(safeCallback ? `/login?callbackUrl=${encodeURIComponent(safeCallback)}` : "/login");
        return;
      }
      await update();
      await router.push(safeCallback || (form.role === "driver" ? "/driver/dashboard" : "/dashboard"));
    } catch {
      setError("Une erreur est survenue — veuillez réessayer");
      setLoading(false);
    }
  }

  if (confirmationEmail) {
    const domain = confirmationEmail.split("@")[1]?.toLowerCase();
    const mailbox = {
      "gmail.com": "https://mail.google.com/",
      "googlemail.com": "https://mail.google.com/",
      "outlook.com": "https://outlook.live.com/mail/",
      "outlook.fr": "https://outlook.live.com/mail/",
      "hotmail.com": "https://outlook.live.com/mail/",
      "hotmail.fr": "https://outlook.live.com/mail/",
      "live.com": "https://outlook.live.com/mail/",
      "live.fr": "https://outlook.live.com/mail/",
      "yahoo.com": "https://mail.yahoo.com/",
      "yahoo.fr": "https://mail.yahoo.com/",
      "icloud.com": "https://www.icloud.com/mail",
      "me.com": "https://www.icloud.com/mail",
      "orange.fr": "https://mail.orange.fr/",
      "wanadoo.fr": "https://mail.orange.fr/",
    }[domain];
    return (
      <div className="auth-page login-page brand-theme">
        <div className="auth-card login-card animate-in signup-dismissible">
          <SignupCloseLink />

          <Link href="/" aria-label="Accueil StrasDrive">
            <KovaLogo size={38} />
          </Link>
          <div className="confirmation-icon">
            <MailCheck size={32} aria-hidden="true" />
          </div>
          <p className="eyebrow" role="status">
            Inscription réussie
          </p>
          <h1 ref={confirmationTitle} tabIndex={-1} className="mt-3">
            Vérifiez votre adresse email
          </h1>
          <p className="muted small mt-4">
            Un lien de confirmation a été envoyé à <strong className="confirmation-email">{confirmationEmail}</strong>.
          </p>
          <p className="muted small mt-3">
            Ouvrez cet email et cliquez sur le lien pour activer votre compte. Vous pourrez ensuite vous connecter et
            commencer à utiliser StrasDrive.
          </p>
          {mailbox && (
            <a
              href={mailbox}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-lg btn-full mt-6"
            >
              Ouvrir ma messagerie <ExternalLink size={18} />
            </a>
          )}
          <Link href="/login" className={`btn ${mailbox ? "btn-secondary" : "btn-primary"} btn-lg btn-full mt-3`}>
            Se connecter après confirmation <ArrowRight size={18} />
          </Link>
          <p className="tiny muted mt-6">
            Vous ne trouvez pas l’email ? Vérifiez les courriers indésirables et assurez-vous de consulter la boîte
            correspondant à l’adresse ci-dessus.
          </p>
          <LegalFooter className="mt-6" />
        </div>
      </div>
    );
  }

  const roleCard = (role, Icon, title, sub) => (
    <button
      type="button"
      onClick={() => setForm((f) => ({ ...f, role }))}
      className="card card-pad"
      style={{
        flex: 1,
        textAlign: "left",
        cursor: "pointer",
        borderColor: form.role === role ? "var(--ink-950)" : "var(--border)",
        borderWidth: 1.5,
        background: form.role === role ? "var(--ink-50)" : "var(--surface)",
        transition: "border-color 150ms, background 150ms",
        padding: 14,
      }}
      aria-pressed={form.role === role}
    >
      <Icon size={20} style={{ color: form.role === role ? "var(--gold-600)" : "var(--ink-400)" }} />
      <div className="small mt-2" style={{ fontWeight: 700 }}>
        {title}
      </div>
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

        <h1 className="text-center" style={{ fontSize: "1.5rem" }}>
          Créez votre compte
        </h1>
        <p className="text-center muted small mt-1 mb-6">Inscription gratuite, prêt en quelques secondes</p>

        {/* Bouton Sociétés VTC */}
        <a href="/contact?topic=fleet_application" className="btn btn-secondary btn-full mb-4">
          Sociétés VTC
        </a>

        {/* Boutons d'inscription OAuth Google et Apple */}
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
          <div className="flex gap-3">
            {roleCard("rider", Navigation, "Voyager", "Réservez des courses en ville")}
            {roleCard("driver", Car, "Conduire", "Gagnez de l’argent à votre rythme")}
          </div>

          {form.role === "driver" && (
            <div
              className="card card-pad tiny"
              style={{ background: "var(--gold-50)", borderColor: "var(--gold-200, var(--border))" }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Documents à fournir après l’inscription (obligatoires en France)
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {REQUIRED_DOCUMENTS.map((d) => (
                  <li key={d.type}>{d.label}</li>
                ))}
              </ul>
              <div className="muted mt-1">
                Votre compte chauffeur est activé une fois ces documents vérifiés par StrasDrive.
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="username">Nom d’utilisateur</label>
            <div className="input-wrap">
              <AtSign size={17} />
              <input
                id="username"
                className={`input ${fieldError === "username" ? "has-error" : ""}`}
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""),
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

          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              className="input"
              type="email"
              value={form.email}
              onChange={set("email")}
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <div className="input-wrap">
              <Lock size={17} />
              <input
                id="password"
                className={`input ${fieldError === "password" ? "has-error" : ""}`}
                type="password"
                value={form.password}
                onChange={set("password")}
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
                className={`input ${fieldError === "confirmPassword" ? "has-error" : ""}`}
                type="password"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                placeholder="Saisissez à nouveau votre mot de passe"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {error && <p className="input-error-msg">{error}</p>}

          <label
            htmlFor="acceptTerms"
            className="tiny muted flex gap-2"
            style={{ lineHeight: 1.6, alignItems: "flex-start", cursor: "pointer" }}
          >
            <input
              id="acceptTerms"
              type="checkbox"
              checked={form.acceptTerms}
              onChange={(e) => setForm((f) => ({ ...f, acceptTerms: e.target.checked }))}
              required
              style={{ marginTop: 3, accentColor: "var(--ink-950)", flexShrink: 0 }}
            />
            <span>
              J’accepte les{" "}
              <Link href="/terms" style={{ fontWeight: 600, color: "var(--text)", textDecoration: "underline" }}>
                Conditions d’utilisation
              </Link>{" "}
              et j’ai lu la{" "}
              <Link href="/privacy" style={{ fontWeight: 600, color: "var(--text)", textDecoration: "underline" }}>
                Politique de confidentialité
              </Link>
              , qui explique comment mes données sont utilisées.
            </span>
          </label>

          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? (
              <span className="spinner" />
            ) : (
              <>
                Créer un compte <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="text-center small muted mt-6">
          Vous avez déjà un compte ?{" "}
          <Link href="/login" style={{ fontWeight: 600, color: "var(--text)" }}>
            Se connecter
          </Link>
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

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Inscription · StrasDrive" },
      { name: "description", content: "StrasDrive — inscription, service de mise en relation VTC et tarifs en euros." },
      { property: "og:title", content: "Inscription · StrasDrive" },
      {
        property: "og:description",
        content: "StrasDrive — inscription, service de mise en relation VTC et tarifs en euros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});
