import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Car, Route as RouteIcon, Clock3, RefreshCw, Server, Users, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import AdminLayout from '@/components/AdminLayout';
import { apiFetch } from '@/lib/archive-fetch';
const dateLabel = value => new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const tooltipStyle = { background: '#151e2d', border: '1px solid #ffffff20', borderRadius: 12, color: '#f1f5f9' };
const number = value => new Intl.NumberFormat('fr-FR').format(value);
export function MonitoringPage() {
  const [data, setData] = useState(null), [samples, setSamples] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [receivedAt, setReceivedAt] = useState(null), [clock, setClock] = useState(Date.now());
  const running = useRef(false), alive = useRef(false);
  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true; setBusy(true);
    const started = performance.now();
    try {
      const response = await apiFetch('/api/admin/monitoring');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Mesures indisponibles');
      if (!alive.current) return;
      const at = Date.now(), sample = { ...payload, at, responseMs: Math.round(performance.now() - started) };
      setData(sample); setReceivedAt(at); setError('');
      setSamples(previous => [...previous.filter(p => at - p.at <= 30 * 60000), sample].slice(-180));
    } catch (err) { if (alive.current) setError(err.message || 'Impossible d’actualiser les mesures.'); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }, []);
  useEffect(() => {
    alive.current = true; refresh();
    const visible = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(() => { setClock(Date.now()); if (!document.hidden) refresh(); }, 10000);
    document.addEventListener('visibilitychange', visible);
    return () => { alive.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  const stale = receivedAt && clock - receivedAt > 30000;
  const percent = data ? data.driversOnline / data.objectives.drivers * 100 : 0;
  return <div className="site-monitor-page">
    <header className="site-monitor-header"><div><p className="site-monitor-eyebrow"><Activity size={15} /> SUPERVISION</p><h1>Le réseau, en direct.</h1><p className="site-monitor-subtitle">Activité des courses et réactivité du service.</p></div><div className="site-monitor-controls"><span className={`monitor-live ${error || stale ? 'is-stale' : ''}`}><i />{error || stale ? 'À actualiser' : data ? 'En direct' : 'Connexion…'}</span><button type="button" className="monitor-refresh" disabled={busy} onClick={refresh} aria-label="Actualiser les mesures"><RefreshCw size={17} className={busy ? 'spin' : ''} /></button></div></header>
    <div className="monitor-update-line"><span>Actualisation toutes les 10 secondes</span><span>{receivedAt ? `Dernière mesure : ${dateLabel(data.sampledAt)}` : 'Première mesure en cours…'}</span></div>
    {error && <div className="monitor-notice" role="alert">{error} {data && 'Les dernières valeurs connues restent affichées.'}</div>}
    {!data && !error && <p role="status" className="monitor-notice">Chargement des mesures…</p>}
    {data && <>
      <section className="monitor-kpis" aria-label="Indicateurs actuels">
        {[{label:'Chauffeurs en ligne',value:data.driversOnline,Icon:Car,tone:'cyan',hint:'Statut en ligne dans l’application'}, {label:'Courses actives',value:data.activeRides,Icon:RouteIcon,tone:'violet',hint:'Acceptées, arrivées ou en cours'}, {label:'Demandes en attente',value:data.searchingRides,Icon:Clock3,tone:'amber',hint:'Recherche d’un chauffeur'}, {label:'Courses terminées · 1 h',value:data.completedLastHour,Icon:CheckCircle2,tone:'green',hint:'Sur les 60 dernières minutes'}].map(({label,value,Icon,tone,hint}) => <article key={label} className={`monitor-card monitor-kpi tone-${tone}`}><span className="monitor-kpi-label"><Icon size={18}/>{label}</span><strong>{number(value)}</strong><small>{hint}</small></article>)}
      </section>
      <section className="monitor-charts">
        <article className="monitor-card"><div className="monitor-chart-heading"><div><h2>Activité du réseau</h2><p>Évolution depuis l’ouverture de cette page</p></div><span className="monitor-period">30 min max.</span></div><div className="monitor-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={samples} margin={{top:12,right:10,left:-20,bottom:0}}><defs><linearGradient id="monitorDriverFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={.3}/><stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ffffff0c" vertical={false}/><XAxis dataKey="at" type="number" domain={['dataMin','dataMax']} tickFormatter={dateLabel} minTickGap={65} stroke="#718198" fontSize={10}/><YAxis allowDecimals={false} stroke="#718198" fontSize={11}/><Tooltip contentStyle={tooltipStyle} labelFormatter={dateLabel}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/><Area type="monotone" dataKey="driversOnline" name="Chauffeurs en ligne" stroke="#22d3ee" fill="url(#monitorDriverFill)" strokeWidth={2} isAnimationActive={false} dot={samples.length===1}/><Area type="monotone" dataKey="activeRides" name="Courses actives" stroke="#a78bfa" fill="transparent" strokeWidth={2} isAnimationActive={false} dot={samples.length===1}/><Area type="monotone" dataKey="searchingRides" name="Demandes en attente" stroke="#fbbf24" fill="transparent" strokeWidth={2} isAnimationActive={false} dot={samples.length===1}/></AreaChart></ResponsiveContainer></div></article>
        <article className="monitor-card"><div className="monitor-chart-heading"><div><h2>Temps de réponse</h2><p>Mesure depuis votre connexion administrateur</p></div><strong className="monitor-ms">{number(data.responseMs)}<small> ms</small></strong></div><div className="monitor-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={samples} margin={{top:12,right:10,left:-20,bottom:0}}><CartesianGrid stroke="#ffffff0c" vertical={false}/><XAxis dataKey="at" type="number" domain={['dataMin','dataMax']} tickFormatter={dateLabel} minTickGap={65} stroke="#718198" fontSize={10}/><YAxis stroke="#718198" fontSize={11}/><Tooltip contentStyle={tooltipStyle} labelFormatter={dateLabel}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/><Line type="monotone" dataKey="responseMs" name="Réponse API (ms)" stroke="#34d399" strokeWidth={2} dot={samples.length===1} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></article>
      </section>
      <section className="monitor-bottom-grid">
        <article className="monitor-card"><h2>Vos objectifs d’activité</h2><p className="monitor-explanation">Ces pourcentages comparent l’activité à votre objectif. Ils ne représentent pas la saturation du serveur.</p><div className="monitor-target-line"><span><Car size={16}/> Chauffeurs en ligne</span><strong>{percent.toLocaleString('fr-FR',{maximumFractionDigits:1})} %</strong></div><div className="monitor-progress" role="progressbar" aria-label="Chauffeurs en ligne par rapport à l’objectif de 500" aria-valuemin={0} aria-valuemax={data.objectives.drivers} aria-valuenow={Math.min(data.driversOnline,data.objectives.drivers)}><span style={{width:`${Math.min(100,percent)}%`}}/></div><p className="monitor-target-caption">{number(data.driversOnline)} sur un objectif de {number(data.objectives.drivers)} chauffeurs</p><div className="monitor-target-line"><span><Users size={16}/> Clients connectés</span><strong className="monitor-unavailable">Non mesuré</strong></div><p className="monitor-target-caption">Objectif : {number(data.objectives.clients)} clients simultanés. Le compteur de connexions n’est pas encore relié.</p></article>
        <article className="monitor-card monitor-infra"><div className="monitor-infra-icon"><Server size={24}/></div><h2>Charge technique du serveur</h2><span className="monitor-neutral-badge">Mesures de l’hébergeur à connecter</span><p className="monitor-explanation">Les pourcentages CPU, mémoire et capacité maximale ne sont pas disponibles ici. Les courses et le temps de réponse ne suffisent pas à calculer un pourcentage de charge fiable.</p><div className="monitor-infra-values"><span>CPU <strong>—</strong></span><span>Mémoire <strong>—</strong></span><span>Capacité utilisée <strong>—</strong></span></div></article>
      </section>
    </>}
  </div>;
}
export const Route = createFileRoute('/_authenticated/admin/monitoring')({head: () => ({ meta: [{"title": "Supervision du réseau · StrasDrive"}, {"name": "description", "content": "Suivi administratif des courses et de l’activité du réseau StrasDrive."}, {"property": "og:title", "content": "Supervision du réseau · StrasDrive"}, {"property": "og:description", "content": "Suivi administratif des courses et de l’activité du réseau StrasDrive."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }),  component: () => <AdminLayout><MonitoringPage/></AdminLayout> });
