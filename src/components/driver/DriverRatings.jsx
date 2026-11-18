import { useEffect, useId, useRef, useState } from 'react';
import { Star, ShieldCheck } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import useDriverData from '@/hooks/useDriverData';
import { apiFetch } from '@/lib/archive-fetch';

const STAR_POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26';
function FillingStar({ fraction, onClick, bursting, filling, fast }) {
  const clip = `rating-star-${useId().replace(/:/g, '')}`;
  return <button type="button" className={`rating-star-button ${bursting ? 'is-bursting' : ''} ${filling ? 'is-filling' : ''} ${fast ? 'is-fast' : ''}`} onClick={onClick} aria-label="Étoile de progression des avis" style={{ '--star-level': `${Math.max(0, Math.min(1, fraction)) * 100}%` }}>
    <svg className="rating-fill-star" viewBox="0 0 24 24" aria-hidden="true">
      <defs><clipPath id={clip}><polygon points={STAR_POINTS} /></clipPath></defs>
      <polygon points={STAR_POINTS} fill="rgba(232,187,60,.04)" />
      <g clipPath={`url(#${clip})`}><rect className="rating-star-liquid" x="0" y="0" width="24" height="24" fill="#e8bb3c" /></g>
      <polygon points={STAR_POINTS} fill="none" stroke="#e8bb3c" strokeWidth=".65" strokeLinejoin="round" />
    </svg>
    <span className="rating-star-halo" aria-hidden="true" />
    {Array.from({length:20},(_,index) => <i className="rating-star-spark" key={index} aria-hidden="true" style={{'--spark-angle': `${index * 18}deg`, '--spark-distance': `${72 + index % 4 * 20}px`, '--spark-delay': `${index % 3 * 25}ms`}} />)}
  </button>;
}

function RatingExperience({ data }) {
  const eligible = !data.locked && !data.priority && !data.unlockAnimationSeen;
  const [phase, setPhase] = useState(eligible ? 'checking' : 'idle');
  const [demo, setDemo] = useState(false);
  const [preview, setPreview] = useState(false);
  const claimed = useRef(false), mounted = useRef(false), taps = useRef(0);
  const threshold = data.threshold || 50;
  const fraction = Math.min(1, data.count / threshold);

  useEffect(() => {
    mounted.current = true;
    if (eligible && !claimed.current) {
      claimed.current = true;
      setPhase('checking');
      apiFetch('/api/drivers/me/ratings-unlock', { method: 'POST' })
        .then(async (response) => {
          if (!response.ok) throw new Error('Déblocage indisponible');
          return response.json();
        })
        .then((result) => { if (mounted.current) setPhase(result.celebrate ? 'filling' : 'idle'); })
        .catch(() => { if (mounted.current) setPhase('idle'); });
    }
    return () => { mounted.current = false; };
  }, [eligible]);

  useEffect(() => {
    if (!['filling','bursting'].includes(phase)) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 80 : phase === 'filling' ? (demo ? 450 : 850) : (demo ? 650 : 1100);
    const timer = setTimeout(() => {
      if (phase === 'filling') setPhase('bursting');
      else { if (demo) setPreview(true); setPhase('idle'); }
    }, duration);
    return () => clearTimeout(timer);
  }, [phase, demo]);

  function tapStar() {
    if (phase !== 'idle') return;
    taps.current += 1;
    if (taps.current === 25) {
      taps.current = 0; setDemo(true); setPhase('filling');
    }
  }
  const animating = ['checking','filling','bursting'].includes(phase);
  if ((data.locked && !preview) || animating) return <div className={`driver-ratings-unlock ${demo ? 'is-demo' : ''}`} aria-busy={animating}>
    <strong className="driver-ratings-progress" aria-label={`${data.count} avis sur ${threshold}`}>{data.count}<span>/{threshold}</span></strong>
    <FillingStar fraction={fraction} onClick={tapStar} bursting={phase === 'bursting'} filling={phase === 'filling'} fast={demo} />
    <h2>{demo && animating ? 'Un peu de magie…' : animating ? 'Vos avis se dévoilent' : 'Votre aperçu détaillé se prépare'}</h2>
    <p>{animating ? 'Place à votre aperçu détaillé.' : `Atteignez ${threshold} avis pour débloquer un aperçu plus détaillé de vos notes.`}</p>
    <div className="driver-ratings-progress-track" role="progressbar" aria-label="Progression vers le détail des avis" aria-valuemin={0} aria-valuemax={threshold} aria-valuenow={Math.min(data.count, threshold)}><span style={{ width: `${fraction * 100}%` }} /></div>
  </div>;

  // The easter egg reveals a labelled empty preview, never private reviews hidden by the server.
  const previewOnly = data.locked && preview;
  const shown = previewOnly ? { average:null, count:data.count, distribution:[5,4,3,2,1].map(stars=>({stars,count:0})), comments:[], priority:false } : data;
  const max = Math.max(1, ...shown.distribution.map((row) => row.count));
  return <div className="driver-ratings rating-details-reveal">
    {previewOnly && <p className="rating-demo-label" role="status">Démonstration · Vos vrais avis restent verrouillés jusqu’à {threshold} notes.</p>}
    <div className="driver-rating-score"><button type="button" className="rating-score-star" onClick={tapStar} aria-label="Étoile de la note chauffeur"><Star size={34} aria-hidden="true" /></button><strong>{shown.average == null ? '—' : shown.average.toFixed(2).replace('.', ',')}</strong><span>{shown.count} note{shown.count > 1 ? 's' : ''}</span></div>
    <p className="small muted">Vos 500 dernières notes au maximum. Les avis apparaissent après 12 heures pour préserver la confidentialité.</p>
    <div className="driver-rating-distribution" aria-label="Répartition des notes">
      {shown.distribution.map((row) => <div className="driver-rating-bar" key={row.stars} aria-label={`${row.stars} étoiles : ${row.count} notes`}>
        <span>{row.stars} <Star size={13} aria-hidden="true" /></span><div className="driver-rating-track"><span style={{ width: `${row.count / max * 100}%` }} /></div><strong>{previewOnly ? '—' : row.count}</strong>
      </div>)}
    </div>
    <p className="driver-rating-privacy small"><ShieldCheck size={20} /><span>Les auteurs restent anonymes. Aucune coordonnée de passager n’est affichée.</span></p>
    <h3>{shown.priority ? 'Tous les avis' : 'Vos avis positifs'}</h3>
    {!shown.comments.length && <p className="muted small">{previewOnly ? 'Vos commentaires apparaîtront après le déblocage réel.' : 'Aucun commentaire à afficher pour le moment.'}</p>}
    {shown.comments.map((comment, index) => <article className="driver-rating-comment" key={index}>
      <span aria-label={`${comment.stars} étoiles`} className="driver-rating-stars">{'★'.repeat(comment.stars)}{'☆'.repeat(5-comment.stars)}</span>
      <p>{comment.text}</p>
    </article>)}
  </div>;
}
function RatingContent() {
  const { data, error, reload } = useDriverData('/api/drivers/me/ratings');
  if (!data) return <div>{error ? <><p role="alert">{error}</p><button className="btn btn-secondary" onClick={reload}>Réessayer</button></> : <p className="muted">Chargement de vos avis…</p>}</div>;
  return <RatingExperience data={data} />;
}
export default function DriverRatings({ open, onClose }) {
  return <Modal open={open} onClose={onClose} title="Votre note chauffeur" portal keyboardSafe sheetOnMobile={false}>{open && <RatingContent />}</Modal>;
}
