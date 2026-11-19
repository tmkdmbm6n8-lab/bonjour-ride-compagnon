import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Link from "@/lib/archive-navigation";
import { apiFetch as fetch } from "@/lib/archive-fetch";
import { useSession } from "@/lib/archive-auth";
import { KovaLogo } from "@/components/brand/KovaLogo";
import { Avatar } from "@/components/ui/bits";
import { readPendingClaim, savePendingClaim, clearPendingClaim } from "@/lib/private-client-claim";

async function post(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Une erreur est survenue");
  return data;
}

function JoinPage() {
  const { data: session, status: sessionStatus } = useSession();
  const signedIn = Boolean(session?.user);
  const [claim, setClaim] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | confirm | busy | done | error
  const [error, setError] = useState("");

  // The QR code token travels in the URL fragment (never sent to servers or analytics), then is exchanged for a claim.
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("invite");
    if (token) window.history.replaceState(null, "", window.location.pathname);
    (async () => {
      try {
        if (token) {
          const scanned = await post("/api/private-clients/scan", { token });
          savePendingClaim(scanned);
          setClaim(scanned);
        } else {
          const stored = readPendingClaim();
          if (!stored) throw new Error("Aucune invitation en cours. Scannez le QR code de votre chauffeur.");
          setClaim(stored);
        }
        setState("ready");
      } catch (e) {
        setError(e.message);
        setState("error");
      }
    })();
  }, []);

  async function link(confirmReplacement) {
    if (!claim || state === "busy") return;
    setState("busy");
    setError("");
    try {
      const result = await post("/api/private-clients/redeem", { claimToken: claim.claimToken, confirmReplacement });
      if (result.requiresConfirmation) return setState("confirm");
      if (!result.ok) throw new Error(result.error || "Impossible d’ajouter ce chauffeur");
      clearPendingClaim();
      setState("done");
    } catch (e) {
      setError(e.message);
      setState(/expir|déjà été utilisée|vous-même/.test(e.message) ? "error" : "ready");
      if (/expir|déjà été utilisée|vous-même/.test(e.message)) clearPendingClaim();
    }
  }

  const name = claim?.driver?.name || "votre chauffeur";
  return (
    <div className="auth-page login-page brand-theme">
      <div className="auth-card login-card animate-in">
        <div className="flex justify-center mb-6">
          <Link href="/" aria-label="Accueil StrasDrive">
            <KovaLogo size={38} />
          </Link>
        </div>
        {state === "loading" || sessionStatus === "loading" ? (
          <p className="small muted text-center" role="status">
            <span className="spinner" /> Vérification du QR code…
          </p>
        ) : state === "error" ? (
          <div className="text-center">
            <h1 className="h2">Invitation indisponible</h1>
            <p className="small muted mt-2" role="alert">{error}</p>
            <Link href={signedIn ? "/dashboard" : "/"} className="btn btn-secondary btn-full mt-6">
              Continuer
            </Link>
          </div>
        ) : state === "done" ? (
          <div className="text-center">
            <Avatar name={name} src={claim?.driver?.avatar || ""} size="lg" />
            <h1 className="h2 mt-4">{name} est votre chauffeur favori</h1>
            <p className="small muted mt-2">
              Il apparaîtra en tête de vos recherches avec son temps d’arrivée. Vous restez libre de choisir une autre gamme.
            </p>
            <Link href="/dashboard" className="btn btn-primary btn-full mt-6">
              Réserver une course
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <Avatar name={name} src={claim?.driver?.avatar || ""} size="lg" />
            <h1 className="h2 mt-4">Choisir {name} comme chauffeur favori ?</h1>
            <p className="small muted mt-2">
              {claim?.driver?.name || "Votre chauffeur"} verra votre prénom dans sa liste de clients privés. Vous pourrez le retirer à tout moment ; il en sera
              informé.
            </p>
            {error && (
              <p className="small mt-3" role="alert" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
            {!signedIn ? (
              <div className="flex-col gap-2 mt-6">
                <Link href="/signup?callbackUrl=%2Fjoin" className="btn btn-primary btn-full">
                  Créer mon compte
                </Link>
                <Link href="/login?callbackUrl=%2Fjoin" className="btn btn-secondary btn-full">
                  J’ai déjà un compte
                </Link>
                <p className="tiny muted mt-2">Invitation gardée 24 h sur cet appareil, le temps de confirmer votre e-mail.</p>
              </div>
            ) : state === "confirm" ? (
              <div className="flex-col gap-2 mt-6">
                <p className="small">Vous avez déjà un chauffeur favori. Le remplacer par {name} ?</p>
                <button type="button" className="btn btn-primary btn-full" onClick={() => link(true)}>
                  Remplacer mon favori
                </button>
                <Link href="/dashboard" className="btn btn-secondary btn-full" onClick={clearPendingClaim}>
                  Garder mon favori actuel
                </Link>
              </div>
            ) : (
              <div className="flex-col gap-2 mt-6">
                <button type="button" className="btn btn-primary btn-full" disabled={state === "busy"} onClick={() => link(false)}>
                  {state === "busy" ? <span className="spinner" /> : `Choisir ${name}`}
                </button>
                <Link href="/dashboard" className="btn btn-secondary btn-full" onClick={clearPendingClaim}>
                  Non merci
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Choisir mon chauffeur favori · StrasDrive" },
      { name: "description", content: "Ajoutez votre chauffeur StrasDrive en favori après avoir scanné son QR code." },
      { property: "og:title", content: "Choisir mon chauffeur favori · StrasDrive" },
      { property: "og:description", content: "Ajoutez votre chauffeur StrasDrive en favori après avoir scanné son QR code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JoinPage,
});
