import { useEffect, useRef } from "react";
import { Navigation, CheckCircle2, Users } from "lucide-react";

/**
 * Affiché quand le chauffeur clique sur « Accepter ».
 * status: 'spinning' | 'won' | 'lost'
 */
export default function DispatchWheel({ status, onDone }) {
  // Garder la référence de onDone pour éviter que les rafraîchissements
  // du dashboard n'annulent le minuteur de fermeture.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Fermeture automatique : 1,2 s si gagné, 2,2 s si perdu
  useEffect(() => {
    if (status !== "won" && status !== "lost") return undefined;
    const delay = status === "won" ? 1200 : 2200;
    const t = setTimeout(() => {
      onDoneRef.current?.();
    }, delay);
    return () => clearTimeout(t);
  }, [status]);

  const canDismiss = status === "won" || status === "lost";

  return (
    <div
      className="dispatch-wheel-backdrop"
      role="status"
      aria-live="assertive"
      onClick={() => {
        if (canDismiss) onDoneRef.current?.();
      }}
    >
      <div className="dispatch-wheel-card" onClick={(e) => e.stopPropagation()}>
        <div className={`dispatch-wheel dispatch-wheel-${status}`}>
          <span className="dispatch-wheel-ring" />
          <span className="dispatch-wheel-icon">
            {status === "spinning" && <Navigation size={44} />}
            {status === "won" && <CheckCircle2 size={56} />}
            {status === "lost" && <Users size={48} />}
          </span>
        </div>
        <h3 className="dispatch-wheel-title">
          {status === "spinning" && "Attribution en cours…"}
          {status === "won" && "Course remportée !"}
          {status === "lost" && "Attribuée à un autre chauffeur"}
        </h3>
        <p className="small muted">
          {status === "spinning" && "Plusieurs chauffeurs ont accepté, la flèche choisit…"}
          {status === "won" && "Rendez-vous au point de prise en charge."}
          {status === "lost" && "Cette fois, un collègue l’a eue. Restez en ligne, la prochaine arrive."}
        </p>

        {canDismiss && (
          <button
            type="button"
            className="btn btn-secondary btn-sm mt-3"
            onClick={() => onDoneRef.current?.()}
            style={{ minWidth: 130 }}
          >
            {status === "won" ? "Voir la course" : "Fermer"}
          </button>
        )}
      </div>
    </div>
  );
}
