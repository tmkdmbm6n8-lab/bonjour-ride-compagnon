import { currentAndNextBadge } from '@/lib/driver-achievements';
import { Star, Route, Award } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/bits';
import useDriverData from '@/hooks/useDriverData';
import DriverBadge from './DriverBadge';
function OverviewContent() {
  const {data,error,reload}=useDriverData('/api/drivers/me/achievements',0);
  if(!data)return <div>{error?<><p role="alert">{error}</p><button className="btn btn-secondary" onClick={reload}>Réessayer</button></>:<p>Chargement de votre profil…</p>}</div>;
  const earned=data.achievements.badges.filter(b=>b.earned).length;
  const {current,next}=currentAndNextBadge(data.achievements.badges);
  return <div className="driver-profile-overview driver-profile-compact">
    <header className="driver-profile-intro"><Avatar name={data.name} src={data.avatar} size="md"/><h2>{data.name}</h2><p>{data.vehicle?.make} {data.vehicle?.model}</p><span className="driver-profile-member">Chauffeur StrasDrive{data.memberSince ? ` depuis ${new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(new Date(data.memberSince))}`:''}</span></header>
    <div className="driver-profile-numbers"><div><Star size={20}/><strong>{data.rating.average==null?'—':data.rating.average.toFixed(2).replace('.',',')}</strong><span>Note chauffeur*</span></div><div><Route size={20}/><strong>{data.completedTrips.toLocaleString('fr-FR')}</strong><span>Courses terminées</span></div><div><Award size={20}/><strong>{earned}</strong><span>Distinctions</span></div></div>
    <p className="tiny muted">* Sur vos 500 dernières notes au maximum.</p>
    <section className="driver-badges-section"><h3>Vos distinctions</h3>
      <div className="driver-five-star-total"><Star size={20} fill="currentColor"/><strong>{data.achievements.count.toLocaleString('fr-FR')}</strong><span>notes 5 étoiles</span></div>
      {data.achievements.next ? <p className="driver-next-badge">Encore {data.achievements.next.remaining.toLocaleString('fr-FR')} notes de 5 étoiles pour la prochaine distinction.</p>:<p className="driver-next-badge">Légende StrasDrive : toutes les distinctions sont obtenues.</p>}
      <div className="driver-badges-grid">
        {current ? <article className="driver-badge-tile earned"><small>Badge actuel</small><DriverBadge badge={current}/><h4>{current.name}</h4><span>{current.threshold.toLocaleString('fr-FR')} notes 5 étoiles</span></article> : <article className="driver-badge-tile driver-badge-empty"><small>Badge actuel</small><Award size={56}/><h4>Aucun badge obtenu</h4><span>Votre première distinction se prépare.</span></article>}
        {next && <article className="driver-badge-tile locked"><small>Prochain badge</small><DriverBadge badge={next}/><h4>{next.name}</h4><span>{next.threshold.toLocaleString('fr-FR')} notes 5 étoiles</span></article>}
      </div>
      <p className="tiny muted mt-3">Les distinctions sont calculées sur toute votre activité chauffeur, avec un délai de publication de 12 heures. Les courses de test sont exclues.</p>
    </section>
  </div>;
}
export default function DriverProfileOverview({open,onClose}) {
  return <Modal open={open} onClose={onClose} title="Votre profil chauffeur" maxWidth={520} className="driver-profile-modal" portal keyboardSafe sheetOnMobile={false}>{open&&<OverviewContent/>}</Modal>;
}
