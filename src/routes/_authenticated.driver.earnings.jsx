import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import DriverLayout from '@/components/DriverLayout';
import Link from '@/lib/archive-navigation';
import PayoutCard from '@/components/driver/PayoutCard';
import { Loading, money } from '@/components/ui/bits';
import useDriverData from '@/hooks/useDriverData';
import { parisDay, shiftDay, workDuration } from '@/lib/vtc-dates';
import MapView from '@/components/ArchiveMap';
import Modal from '@/components/ui/Modal';
import { drawableRoute } from '@/lib/utils/route-display';

function EarningsPage() {
  const [day, setDay] = useState(parisDay()), [details, setDetails] = useState(false), [selectedDay, setSelectedDay] = useState(null), [mapOpen, setMapOpen] = useState(false), [rideIndex, setRideIndex] = useState(0);
  const { data, error, reload } = useDriverData(`/api/drivers/me/earnings?day=${day}`);
  const date = (value) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00Z`));
  if (!data) return <div className="driver-tab-page"><h1>Revenus</h1>{error ? <div role="alert"><p>{error}</p><button className="driver-chip" onClick={reload}>Réessayer</button></div> : <Loading label="Chargement des revenus…" />}</div>;
  const week = data.week;
  const max = Math.max(1, ...week.byDay.map((row) => row.earnings));
  const selected = week.byDay.find((row) => row._id === selectedDay);
  const ride = data.recentRides[rideIndex];
  return <div className="driver-tab-page earnings-page">
    <div className="driver-tab-title"><div><p className="drv-eyebrow">Courses terminées</p><h1>Revenus</h1></div></div>
    {error && <p className="driver-notice" role="alert">Les données n’ont pas pu être actualisées. {error}</p>}
    <div className="earnings-week-controls"><button onClick={() => { setDay(shiftDay(day, -7)); setSelectedDay(null); }} aria-label="Semaine précédente"><ChevronLeft size={23} /></button><span>{date(week.start)} – {date(shiftDay(week.end, -1))}</span><button disabled={week.end > parisDay()} onClick={() => { setDay(shiftDay(day, 7)); setSelectedDay(null); }} aria-label="Semaine suivante"><ChevronRight size={23} /></button></div>
    <div className="earnings-overview"><div><p>{selected ? date(selected._id) : 'Cette semaine'}</p><strong>{money(selected ? selected.earnings : week.total)}</strong></div><div className="earnings-chart" aria-label="Revenus journaliers">{week.byDay.map((row, index) => <button key={row._id} className={selectedDay === row._id ? 'selected' : ''} onClick={() => setSelectedDay(selectedDay === row._id ? null : row._id)} aria-label={`${date(row._id)} : ${money(row.earnings)}, ${row.trips} courses, ${workDuration(row.activitySeconds)}`} aria-pressed={selectedDay === row._id}><span style={{ height: row.earnings > 0 ? `${Math.max(3, row.earnings / max * 100)}%` : 0 }} /><small>{['L', 'M', 'M', 'J', 'V', 'S', 'D'][index]}</small></button>)}</div></div>
    <div className="earnings-stats"><div><span>Temps en course</span><strong>{workDuration(selected ? selected.activitySeconds : week.activitySeconds)}</strong></div><div><span>Courses</span><strong>{selected ? selected.trips : week.trips}</strong></div><div><span>Note chauffeur</span><strong>{Number(data.stats?.averageRating ?? 5).toFixed(2)}</strong></div></div>
    <p className="driver-feed-note">Temps réellement enregistré pendant les courses terminées, approche comprise. Le temps d’attente hors course n’est pas comptabilisé.</p>
    <button className="earnings-details-button" onClick={() => setDetails(!details)} aria-expanded={details}>{details ? 'Masquer les détails' : 'Voir les détails'}</button>
    {details && <section className="earnings-daily"><h2>Chaque jour</h2>{week.byDay.map((row) => <div key={row._id}><span>{date(row._id)}<small>{row.trips} courses · {workDuration(row.activitySeconds)}</small></span><strong>{money(row.earnings)}</strong></div>)}<h2>Courses récentes de cette semaine</h2>{data.recentRides.length === 0 && <p className="driver-muted">Aucune course terminée.</p>}{data.recentRides.map((ride) => <Link className="driver-menu-row" key={ride.id} href="/driver/trips"><span>{ride.dropoff?.address}<small>{new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ride.completedAt))}</small></span><strong>{money(ride.fare?.driverEarnings)}</strong></Link>)}</section>}
    <Link href="/driver/wallet" className="driver-menu-row earnings-balance"><span>Solde</span><strong>{money(data.wallet.balance)}</strong><ChevronRight size={21} /></Link>
    <details className="earnings-payout"><summary>Versements et retraits</summary><PayoutCard /></details>
    <button className="earnings-map-banner" onClick={() => setMapOpen(true)}><BarChart3 size={25} /><span>Voir la carte de mes courses de la semaine</span><ChevronRight size={22} /></button>
    <Modal open={mapOpen} onClose={() => setMapOpen(false)} title="Mes courses de la semaine" maxWidth={700}>{!ride ? <p>Aucune course terminée pour cette semaine.</p> : <><select className="input" aria-label="Choisir une course" value={rideIndex} onChange={(e) => setRideIndex(Number(e.target.value))}>{data.recentRides.map((item, index) => <option key={item.id} value={index}>{item.dropoff?.address} · {money(item.fare?.driverEarnings)}</option>)}</select><div className="earnings-route-map"><MapView key={ride.id} center={ride.pickup} pickup={ride.pickup} dropoff={ride.dropoff} routeGeometry={drawableRoute(ride.route?.geometry)} fit /></div></>}</Modal>
  </div>;
}
export const Route = createFileRoute('/_authenticated/driver/earnings')({ head: () => ({ meta: [{ title: 'Revenus · StrasDrive' }] }), component: () => <DriverLayout><EarningsPage /></DriverLayout> });