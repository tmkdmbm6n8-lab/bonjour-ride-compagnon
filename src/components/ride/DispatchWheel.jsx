import { useEffect } from 'react';
import { Navigation, CheckCircle2, Users } from 'lucide-react';

/**
 * Shown when the driver taps "Accept": a gold arrow spins while the server decides who gets the ride,
 * then stops on the result. Less abrupt than a plain "ride already taken" error.
 * status: 'spinning' | 'won' | 'lost'
 */
export default function DispatchWheel({ status, onDone }) {
  useEffect(() => {
    if (status !== 'lost') return undefined;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [status, onDone]);
  useEffect(() => {
    if (status !== 'won') return undefined;
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [status, onDone]);

  return (
    <div className="dispatch-wheel-backdrop" role="status" aria-live="assertive">
      <div className="dispatch-wheel-card">
        <div className={`dispatch-wheel dispatch-wheel-${status}`}>
          <span className="dispatch-wheel-ring" />
          <span className="dispatch-wheel-icon">
            {status === 'spinning' && <Navigation size={44} />}
            {status === 'won' && <CheckCircle2 size={56} />}
            {status === 'lost' && <Users size={48} />}
          </span>
        </div>
        <h3 className="dispatch-wheel-title">
          {status === 'spinning' && 'Attribution en cours…'}
          {status === 'won' && 'Course remportée !'}
          {status === 'lost' && 'Attribuée à un autre chauffeur'}
        </h3>
        <p className="small muted">
          {status === 'spinning' && 'Plusieurs chauffeurs ont accepté, la flèche choisit…'}
          {status === 'won' && 'Rendez-vous au point de prise en charge.'}
          {status === 'lost' && 'Cette fois, un collègue l’a eue. Restez en ligne, la prochaine arrive.'}
        </p>
      </div>
    </div>
  );
}
