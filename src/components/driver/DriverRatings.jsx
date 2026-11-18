import { Star, ShieldCheck } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import useDriverData from '@/hooks/useDriverData';

function RatingContent() {
  const { data, error, reload } = useDriverData('/api/drivers/me/ratings');
  if (!data) return <div>{error ? <><p role="alert">{error}</p><button className="btn btn-secondary" onClick={reload}>Réessayer</button></> : <p className="muted">Chargement de vos avis…</p>}</div>;
  if (data.locked) return <div className="driver-ratings-unlock">
    <strong className="driver-ratings-progress" aria-label={`${data.count} avis sur ${data.threshold}`}>{data.count}<span>/{data.threshold}</span></strong>
    <Star className="driver-ratings-unlock-star" size={104} strokeWidth={1.4} aria-hidden="true" />
    <h2>Votre aperçu détaillé se prépare</h2>
    <p>Atteignez {data.threshold} avis pour débloquer un aperçu plus détaillé de vos notes.</p>
    <div className="driver-ratings-progress-track" role="progressbar" aria-label="Progression vers le détail des avis" aria-valuemin={0} aria-valuemax={data.threshold} aria-valuenow={data.count}><span style={{ width: `${data.count / data.threshold * 100}%` }} /></div>
  </div>;
  const max = Math.max(1, ...data.distribution.map((row) => row.count));
  return <div className="driver-ratings">
    <div className="driver-rating-score"><Star size={34} aria-hidden="true" /><strong>{data.average == null ? '—' : data.average.toFixed(2).replace('.', ',')}</strong><span>{data.count} note{data.count > 1 ? 's' : ''}</span></div>
    <p className="small muted">Vos 500 dernières notes au maximum. Les avis apparaissent après 12 heures pour préserver la confidentialité.</p>
    <div className="driver-rating-distribution" aria-label="Répartition des notes">
      {data.distribution.map((row) => <div className="driver-rating-bar" key={row.stars} aria-label={`${row.stars} étoiles : ${row.count} notes`}>
        <span>{row.stars} <Star size={13} aria-hidden="true" /></span><div className="driver-rating-track"><span style={{ width: `${row.count / max * 100}%` }} /></div><strong>{row.count}</strong>
      </div>)}
    </div>
    <p className="driver-rating-privacy small"><ShieldCheck size={20} /><span>Les auteurs restent anonymes. Aucune coordonnée de passager n’est affichée.</span></p>
    <h3>{data.priority ? 'Tous les avis' : 'Vos avis positifs'}</h3>
    {!data.comments.length && <p className="muted small">Aucun commentaire à afficher pour le moment.</p>}
    {data.comments.map((comment, index) => <article className="driver-rating-comment" key={index}>
      <span aria-label={`${comment.stars} étoiles`} className="driver-rating-stars">{'★'.repeat(comment.stars)}{'☆'.repeat(5-comment.stars)}</span>
      <p>{comment.text}</p>
    </article>)}
  </div>;
}
export default function DriverRatings({ open, onClose }) {
  return <Modal open={open} onClose={onClose} title="Votre note chauffeur" portal keyboardSafe sheetOnMobile={false}>{open && <RatingContent />}</Modal>;
}
