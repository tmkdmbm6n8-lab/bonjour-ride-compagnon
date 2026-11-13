import {createFileRoute} from '@tanstack/react-router';
import AdminLayout from '@/components/AdminLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from '@/lib/archive-navigation';
import { Car, CheckCircle2, Ban } from 'lucide-react';
import { Avatar, Loading, Empty, VEHICLE_LABELS, money } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';

function DriversAdmin() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [pendingOnly, setPendingOnly] = useState(searchParams.get('pending') === '1');
  const [drivers, setDrivers] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setDrivers(null);
    try {
      const res = await fetch(`/api/admin/drivers${pendingOnly ? '?pending=1' : ''}`);
      const data = await res.json();
      if (res.ok) setDrivers(data.drivers);
      else setDrivers([]);
    } catch {
      setDrivers([]);
    }
  }, [pendingOnly]);

  useEffect(() => { load(); }, [load]);

  async function setApproval(driverId, isApproved) {
    setBusyId(driverId);
    try {
      const res = await fetch('/api/admin/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, isApproved }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Échec de la mise à jour', 'error');
      } else {
        toast(isApproved ? 'Chauffeur approuvé' : 'Chauffeur suspendu', 'success');
        load();
      }
    } catch {
      toast('Échec de la mise à jour', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="content-pad">
      <div className="flex items-center justify-between mb-6 wrap gap-3">
        <div>
          <h1 className="page-title">Chauffeurs</h1>
          <p className="page-sub">Approuvez, suivez et gérez votre flotte</p>
        </div>
        <div className="segmented">
          <button className={!pendingOnly ? 'active' : ''} onClick={() => setPendingOnly(false)}>Tous</button>
          <button className={pendingOnly ? 'active' : ''} onClick={() => setPendingOnly(true)}>En attente</button>
        </div>
      </div>

      {drivers === null && <Loading label="Chargement des chauffeurs…" />}
      {drivers?.length === 0 && (
        <Empty icon={Car} title={pendingOnly ? 'Aucune demande en attente' : 'Aucun chauffeur pour le moment'} hint={pendingOnly ? 'Les nouvelles inscriptions de chauffeurs en attente d’approbation apparaîtront ici.' : 'Les chauffeurs inscrits apparaîtront ici.'} />
      )}

      {drivers?.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Chauffeur</th>
                <th>Véhicule</th>
                <th>Gamme</th>
                <th>Courses</th>
                <th>Note</th>
                <th>Revenus</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => ( <tr key={d._id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={d.userId?.name || '?'} src={d.userId?.avatar} size="sm" />
                      <div>
                        <div className="small" style={{ fontWeight: 600 }}>{d.userId?.name || '—'}</div>
                        <div className="tiny muted">@{d.userId?.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="small">
                    {d.vehicle?.plate
                      ? `${d.vehicle.color} ${d.vehicle.make} ${d.vehicle.model} · ${d.vehicle.plate}`
                      : <span className="muted tiny">Aucun véhicule pour le moment</span>}
                  </td>
                  <td className="tiny">{VEHICLE_LABELS[d.vehicle?.type] || '—'}</td>
                  <td className="small mono-nums">{d.stats?.totalTrips || 0}</td>
                  <td className="small mono-nums">{(d.stats?.averageRating ?? 5).toFixed(1)}</td>
                  <td className="small mono-nums">{money(d.stats?.totalEarnings || 0)}</td>
                  <td>
                    {d.isApproved ? (
                      d.isOnline
                        ? <span className="badge badge-success badge-dot">En ligne</span>
                        : <span className="badge badge-neutral badge-dot">Hors ligne</span>
                    ) : (
                      <span className="badge badge-warning badge-dot">En attente</span>
                    )}
                  </td>
                  <td className="text-right">
                    {d.isApproved ? (
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={busyId === d._id}
                        onClick={() => setApproval(d._id, false)}
                      >
                        <Ban size={14} /> Suspendre </button>
                    ) : (
                      <button
                        className="btn btn-success btn-sm"
                        disabled={busyId === d._id}
                        onClick={() => setApproval(d._id, true)}
                      >
                        <CheckCircle2 size={14} /> Approuver </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminDriversPage() {
  return (
    <Suspense fallback={null}>
      <DriversAdmin />
    </Suspense>
  );
}

export const Route=createFileRoute('/_authenticated/admin/drivers')({head:()=>({meta:[{title:"Gestion des chauffeurs · StrasDrive"},{name:'description',content:"StrasDrive — gestion des chauffeurs, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Gestion des chauffeurs · StrasDrive"},{property:'og:description',content:"StrasDrive — gestion des chauffeurs, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <AdminLayout><AdminDriversPage/></AdminLayout>});
