import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import Link from "@/lib/archive-navigation";
import { supabase } from "@/integrations/supabase/client";
import { KovaLogo } from "@/components/brand/KovaLogo";
import LegalFooter from "@/components/shell/LegalFooter";
import { requestAccountEmail, validateNewPassword } from "@/lib/account-recovery";

function RecoverAccount() {
  const [mode, setMode] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    const recoveryLink =
      new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && event === "PASSWORD_RECOVERY" && session) setRecovery(true);
    });
    if (recoveryLink)
      supabase.auth.getSession().then(({ data }) => {
        if (active) {
          if (data.session) setRecovery(true);
          else setError("Ce lien a expiré. Demandez un nouvel e-mail ci-dessous.");
        }
      });
    const params = new URLSearchParams(window.location.search);
    if (params.has("error") || window.location.hash.includes("error="))
      setError("Ce lien est invalide ou a expiré. Demandez un nouvel e-mail.");
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(event) {
    event.preventDefault();
    if (pending.current || (!recovery && cooldown)) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (recovery) {
        const problem = validateNewPassword(password, confirmation);
        if (problem) throw new Error(problem);
        const { error } = await supabase.auth.updateUser({ password });
        if (error)
          throw new Error("Le mot de passe n’a pas pu être modifié. Demandez un nouveau lien.");
        await supabase.auth.signOut({ scope: "local" });
        setRecovery(false);
        setPassword("");
        setConfirmation("");
        setMessage("Mot de passe modifié. Vous pouvez vous connecter.");
      } else {
        await requestAccountEmail(supabase.auth, email, mode, window.location.origin);
        setCooldown(60);
        setMessage(
          "Si cette adresse correspond à un compte concerné, un e-mail va être envoyé. Vérifiez également les indésirables.",
        );
      }
    } catch (err) {
      setError(err.message || "Opération indisponible. Réessayez.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="auth-page brand-theme">
      <div className="auth-card">
        <Link href="/" aria-label="Accueil StrasDrive">
          <KovaLogo size={32} />
        </Link>
        <h1 className="mt-6" style={{ fontSize: "1.4rem" }}>
          {recovery ? "Nouveau mot de passe" : "Retrouver mon compte"}
        </h1>
        {!recovery && (
          <div className="flex gap-2 mt-4 mb-4 wrap">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-pressed={mode === "password"}
              onClick={() => {
                setMode("password");
                setError("");
                setMessage("");
              }}
            >
              Mot de passe oublié
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-pressed={mode === "confirmation"}
              onClick={() => {
                setMode("confirmation");
                setError("");
                setMessage("");
              }}
            >
              E-mail de confirmation
            </button>
          </div>
        )}
        <form onSubmit={submit} className="flex-col gap-4 mt-4">
          {recovery ? (
            <>
              <label className="field">
                Nouveau mot de passe
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                Confirmer le mot de passe
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                />
              </label>
            </>
          ) : (
            <label className="field">
              Adresse e-mail
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={200}
              />
            </label>
          )}
          {message && (
            <p role="status" className="small">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="input-error-msg">
              {error}
            </p>
          )}
          <button
            className="btn btn-primary btn-full"
            disabled={busy || (!recovery && cooldown > 0)}
          >
            {busy
              ? "Veuillez patienter…"
              : recovery
                ? "Enregistrer le mot de passe"
                : cooldown
                  ? `Réessayer dans ${cooldown} s`
                  : "Envoyer l’e-mail"}
          </button>
        </form>
        <Link className="btn btn-ghost btn-full mt-4" href="/login">
          Retour à la connexion
        </Link>
        <LegalFooter className="mt-4" />
      </div>
    </div>
  );
}
export const Route = createFileRoute("/recover-account")({
  head: () => ({
    meta: [{ title: "Retrouver mon compte · StrasDrive" }, { name: "robots", content: "noindex" }],
  }),
  component: RecoverAccount,
});
