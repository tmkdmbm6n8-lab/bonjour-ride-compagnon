import AdminRideRecord from "@/components/admin/AdminRideRecord";
import {createFileRoute} from '@tanstack/react-router';
import AdminLayout from '@/components/AdminLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useState } from 'react';
import { Route as RouteIcon } from 'lucide-react';
import { RideStatusBadge, Loading, Empty, VEHICLE_LABELS, money } from '@/components/ui/bits';
import { formatDate } from '@/lib/utils/geo';

const STATUSES = ['', 'searching', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_drivers'];

function AdminRidesPage() {
  const [rides, setRides] = useState(null);
  const [status, setStatus] = useState('');
  const [day, setDay] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    let ignore = false;
    setRides(null); setError('');
    (async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (status) params.set('status', status);
        if (day) params.set('day', day);
        const res = await fetch(`/api/admin/rides?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Chargement impossible');
        if (!ignore) {
          setRides(data.rides);
          setPagination(data.pagination);
        }
      } catch (error) {
        if (!ignore) { setRides([]); setError(error.message); }
      }
    })();
    return () => { ignore = true; };
  }, [status, page, day]);

  return (
    <div className="content-pad">
      <h1 className="page-title">Courses</h1>
      <p className="page-sub mb-6">Toutes les courses de la plateforme</p>

      <div className="admin-rides-date-filter"><label htmlFor="admin-rides-day">Jour de réservation · heure de Paris</label><input id="admin-rides-day" className="input" type="date" value={day} onChange={event=>{setDay(event.target.value);setPage(1);}}/>{day&&<button className="btn btn-secondary" onClick={()=>{setDay('');setPage(1);}}>Toutes les dates</button>}</div>
      {error&&<p role="alert">{error}</p>}
      <div className="flex gap-2 wrap mb-4">
        {STATUSES.map((s) => ( <button
            key={s || 'all'}
            className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setStatus(s); setPage(1); }}
          >
            {s === '' ? 'Tous' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {rides === null && <Loading label="Chargement des courses…" />}
      {rides?.length === 0 && <Empty icon={RouteIcon} title="Aucune course trouvée" hint="Essayez un autre filtre." />}

      {rides?.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Passager</th>
                <th>Chauffeur</th>
                <th>Itinéraire</th>
                <th>Gamme</th>
                <th>Tarif</th>
                <th>Statut</th><th>Dossier</th>
              </tr>
            </thead>
            <tbody>
              {rides.map((r) => ( <tr key={r._id} onClick={()=>setSelectedId(r._id)} className="admin-ride-open-row">
                  <td className="tiny muted" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.createdAt)}</td>
                  <td className="small">{r.riderId?.name || '—'}</td>
                  <td className="small">{r.driverId?.name || <span className="muted">—</span>}</td>
                  <td className="small" style={{ maxWidth: 260 }}>
                    <div className="truncate">{r.pickup?.address}</div>
                    <div className="truncate muted tiny">→ {r.dropoff?.address}</div>
                  </td>
                  <td className="tiny">{VEHICLE_LABELS[r.vehicleType] || r.vehicleType}</td>
                  <td className="small mono-nums" style={{ fontWeight: 600 }}>
                    {r.status === 'completed' ? money(r.fare?.total) : '—'}
                  </td>
                  <td><RideStatusBadge status={r.status} /></td><td><button className="btn btn-secondary btn-sm" onClick={event=>{event.stopPropagation();setSelectedId(r._id);}} aria-label={`Ouvrir le dossier de la course ${r._id}`}>Ouvrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminRideRecord id={selectedId} onClose={()=>setSelectedId(null)}/>
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
          <span className="small muted" style={{ alignSelf: 'center' }}>{page} / {pagination.pages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
        </div>
      )}
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/admin/rides')({head:()=>({meta:[{title:"Gestion des courses · StrasDrive"},{name:'description',content:"StrasDrive — gestion des courses, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Gestion des courses · StrasDrive"},{property:'og:description',content:"StrasDrive — gestion des courses, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <AdminLayout><AdminRidesPage/></AdminLayout>});
