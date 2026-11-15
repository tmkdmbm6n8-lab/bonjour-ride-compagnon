import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Plane, TrainFront, Bookmark, ChevronLeft, ChevronRight, RefreshCw, BellRing } from 'lucide-react';
import DriverLayout from '@/components/DriverLayout';
import Modal from '@/components/ui/Modal';
import { Loading } from '@/components/ui/bits';
import useDriverData from '@/hooks/useDriverData';
import { useSession } from '@/lib/archive-auth';
import { clock, parisDay, mondayOf, shiftDay } from '@/lib/vtc-dates';
import { transportChanges } from '@/lib/vtc-transport';

function DiscoverPage() {
  const [day, setDay] = useState(parisDay());
  const [kind, setKind] = useState('all'), [direction, setDirection] = useState('arrival');
  const [saved, setSaved] = useState([]), [selectedId, setSelectedId] = useState(null), [changes, setChanges] = useState([]);
  const previous = useRef(null);
  const { data: session } = useSession();
  const storageKey = `strasdrive:saved-transports:${session?.user?.id || 'account'}`;
  const { data, error, reload } = useDriverData(`/api/drivers/me/discover?day=${day}`);
  useEffect(() => { try { const stored = JSON.parse(localStorage.getItem(storageKey) || '[]'); setSaved(Array.isArray(stored) ? stored : []); } catch { setSaved([]); } }, [storageKey]);
  useEffect(() => {
    if (!data) return;
    if (previous.current?.day === data.day) {
      const updated = transportChanges(previous.current.items, data.items);
      if (updated.length) setChanges((old) => [...updated, ...old.filter((item) => !updated.some((next) => next.id === item.id))].slice(0, 12));
    } else setChanges([]);
    previous.current = data;
  }, [data]);
  function toggleSave(id) {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id].slice(-300);
    setSaved(next); try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Saving is optional. */ }
  }
  const selected = data?.items.find((item) => item.id === selectedId);
  const items = (data?.items || []).filter((item) => item.direction === direction && (kind === 'all' || kind === 'saved' ? kind !== 'saved' || saved.includes(item.id) : item.kind === kind));
  const monday = mondayOf(day);
  const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date(`${day}T12:00:00Z`));
  return <div className="driver-tab-page discover-page">
    <div className="driver-tab-title"><div><p className="drv-eyebrow">Gare & aéroport de Strasbourg</p><h1>Découvrir</h1></div><button className="driver-icon-button" onClick={reload} aria-label="Actualiser les horaires"><RefreshCw size={22} /></button></div>
    <div className="driver-filter-row">{[['all', 'Tout', null], ['saved', 'Enregistrés', Bookmark], ['flight', 'Aéroport', Plane], ['train', 'Gare', TrainFront]].map(([key, label, Icon]) => <button key={key} className={`driver-chip ${kind === key ? 'selected' : ''}`} onClick={() => setKind(key)}>{Icon && <Icon size={18} />}{label}</button>)}</div>
    <div className="discover-calendar"><button onClick={() => setDay(shiftDay(day, -7))} aria-label="Semaine précédente"><ChevronLeft size={20} /></button>{Array.from({ length: 7 }, (_, i) => shiftDay(monday, i)).map((date) => <button key={date} className={day === date ? 'selected' : ''} onClick={() => setDay(date)} aria-label={date} aria-pressed={day === date}><span>{['L', 'M', 'M', 'J', 'V', 'S', 'D'][new Date(`${date}T12:00:00Z`).getUTCDay() === 0 ? 6 : new Date(`${date}T12:00:00Z`).getUTCDay() - 1]}</span><strong>{Number(date.slice(-2))}</strong></button>)}<button onClick={() => setDay(shiftDay(day, 7))} aria-label="Semaine suivante"><ChevronRight size={20} /></button></div>
    <div className="discover-day-heading"><h2>{longDay}</h2><input type="date" aria-label="Choisir une date" value={day} min={shiftDay(parisDay(), -30)} max={shiftDay(parisDay(), 365)} onChange={(e) => { if (e.target.value) setDay(e.target.value); }} /></div>
    <div className="driver-filter-row">{[['arrival', 'Arrivées'], ['departure', 'Départs']].map(([key, label]) => <button key={key} className={`driver-chip ${direction === key ? 'selected' : ''}`} onClick={() => setDirection(key)}>{label}</button>)}</div>
    {changes.length > 0 && <div className="discover-changes" role="status"><strong><BellRing size={17} /> Changements récents</strong>{changes.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)}>{item.number} · {item.city} · {item.statusText}{item.estimated ? ` · ${clock(item.estimated)}` : ''}{item.platform ? ` · voie ${item.platform}` : ''}</button>)}</div>}
    {error && <div role="alert" className="driver-notice">{error}<button className="driver-chip" onClick={reload}>Réessayer</button></div>}
    {!data && !error && <Loading label="Chargement des horaires…" />}
    {data?.feeds.filter((feed) => kind === 'all' || kind === 'saved' || feed.kind === kind).map((feed) => feed.warning && <p className="driver-feed-note" key={feed.kind}>{feed.warning}</p>)}
    {data && items.length === 0 && <p className="driver-empty-state">Aucun horaire disponible pour cette sélection.</p>}
    <div className="discover-events">{items.map((item) => <article key={item.id} className="discover-event"><button className="discover-event-main" onClick={() => setSelectedId(item.id)}><div><p className="driver-muted">{clock(item.scheduled)}{item.estimated && item.estimated !== item.scheduled ? ` → ${clock(item.estimated)}` : ''}</p><h3>{item.number} · {item.city || 'Destination non publiée'}</h3><p>{item.carrier}</p><span className={`transport-status ${item.status === 'cancelled' ? 'cancelled' : item.status === 'delayed' ? 'delayed' : ''}`}>{item.statusText}</span>{item.platform && <p>Voie {item.platform}</p>}<p className="driver-muted small">{item.live && !error ? 'Suivi en temps réel' : item.live ? 'Dernière information reçue' : 'Horaire prévu'}</p></div><span className={`discover-event-icon ${item.kind}`}>{item.kind === 'flight' ? <Plane size={46} /> : <TrainFront size={44} />}</span></button><button className="driver-chip" onClick={() => toggleSave(item.id)} aria-pressed={saved.includes(item.id)}><Bookmark size={17} fill={saved.includes(item.id) ? 'currentColor' : 'none'} />{saved.includes(item.id) ? 'Enregistré' : 'Enregistrer'}</button></article>)}</div>
    <footer className="discover-sources">{data?.feeds.filter((feed) => feed.source).map((feed) => <p key={feed.kind}><a href={feed.sourceUrl} target="_blank" rel="noreferrer">{feed.source}</a>{feed.fetchedAt && ` · consulté à ${clock(feed.fetchedAt)}`}</p>)}</footer>
    <Modal open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected ? `${selected.number} · ${selected.city}` : ''} maxWidth={560}>{selected && <dl className="driver-detail-list">{[['Trajet', selected.direction === 'arrival' ? `${selected.city} → Strasbourg` : `Strasbourg → ${selected.city}`], ['Heure prévue', clock(selected.scheduled)], ['Heure estimée', clock(selected.estimated)], ['Statut', selected.statusText], ['Transporteur', selected.carrier], ['Voie', selected.platform], ['Porte', selected.gate], ['Terminal', selected.terminal], ['Source', selected.source], ['Mise à jour publiée', clock(selected.updatedAt)]].filter(([label, value]) => value || ['Porte', 'Terminal', 'Voie'].includes(label)).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Non publié'}</dd></div>)}</dl>}</Modal>
  </div>;
}
export const Route = createFileRoute('/_authenticated/driver/discover')({ head: () => ({ meta: [{ title: 'Découvrir · StrasDrive' }] }), component: () => <DriverLayout><DiscoverPage /></DriverLayout> });