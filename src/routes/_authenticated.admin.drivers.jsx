import {createFileRoute} from '@tanstack/react-router';
import AdminLayout from '@/components/AdminLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from '@/lib/archive-navigation';
import { Car, CheckCircle2, Ban, Star, FileText, ExternalLink, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { DRIVER_DOCUMENTS, documentState } from '@/lib/vtc-documents';
import { STATE_BADGES, frDate } from '@/components/driver/DocumentsCard';
import { Avatar, Loading, Empty, VEHICLE_LABELS, money } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';

function DriverDocuments({ driver, onClose, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/drivers/documents?driverId=${driver._id}`);
    const j = await res.json();
    setData(res.ok ? j : { documents: [] });
  }, [driver._id]);
  useEffect(() => { load(); }, [load]);

  async function review(documentId, status) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/drivers/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, status, reason }),
      });
      const j = await res.json();
      if (!res.ok) toast(j.error || 'Échec de la mise à jour', 'error');
      else {
        toast(status === 'approved' ? 'Document validé' : 'Document refusé : le chauffeur verra le motif', 'success');
        setRejecting(null); setReason('');
        await load(); onChanged();
      }
    } finally { setBusy(false); }
  }

  const byType = Object.fromEntries((data?.documents || []).map((d) => [d.type, d]));
  return (
    <Modal open onClose={onClose} title={`Documents · ${driver.userId?.name || 'Chauffeur'}`} maxWidth={680}>
      {!data && <Loading label="Chargement des documents…" />}
      {data && (
        <>
          <p className="tiny muted mb-2">
            {data.compliance?.approved ?? 0} / {data.compliance?.required ?? 10} documents obligatoires validés.
            {data.compliance?.problem ? ` ${data.compliance.problem}.` : ' Dossier complet.'}
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '65vh', overflowY: 'auto' }}>
            {DRIVER_DOCUMENTS.map((spec) => {
              const doc = byType[spec.type];
              const [badge, label] = STATE_BADGES[documentState(doc)];
              return (
                <li key={spec.type} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div style={{ minWidth: 0 }}>
                      <div className="small" style={{ fontWeight: 600 }}>{spec.label}{!spec.required && <span className="muted tiny"> · facultatif</span>}</div>
                      {doc ? (
                        <div className="tiny muted mt-1">
                          {doc.number ? `${doc.number} · ` : ''}{doc.validUntil ? `valable jusqu’au ${frDate(doc.validUntil)} · ` : ''}envoyé le {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}
                        </div>
                      ) : <div className="tiny muted mt-1">Non fourni</div>}
                      {doc?.status === 'rejected' && doc.rejectionReason && <div className="tiny mt-1" style={{ color: 'var(--danger)' }}>Motif : {doc.rejectionReason}</div>}
                    </div>
                    <span className={`badge ${badge} badge-dot`} style={{ flexShrink: 0 }}>{label}</span>
                  </div>
                  {doc && (
                    <div className="flex gap-2 mt-2 wrap">
                      {doc.url && <a className="btn btn-ghost btn-sm" href={doc.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Voir</a>}
                      {doc.status !== 'approved' && <button className="btn btn-success btn-sm" disabled={busy} onClick={() => review(doc.id, 'approved')}><CheckCircle2 size={14} /> Valider</button>}
                      {doc.status !== 'rejected' && rejecting !== doc.id && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => { setRejecting(doc.id); setReason(''); }}><X size={14} /> Refuser</button>}
                    </div>
                  )}
                  {rejecting === doc?.id && (
                    <div className="flex gap-2 mt-2">
                      <input className="input" placeholder="Motif du refus (illisible, expiré, mauvais document…)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motif du refus" />
                      <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => review(doc.id, 'rejected')}>Confirmer</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}

function DriversAdmin() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [pendingOnly, setPendingOnly] = useState(searchParams.get('pending') === '1');
  const [drivers, setDrivers] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [docsFor, setDocsFor] = useState(null);

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

  async function setPriority(driverId, isPriority) {
    setBusyId(driverId);
    try {
      const res = await fetch('/api/admin/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, isPriority }),
      });
      const data = await res.json();
      if (!res.ok) toast(data.error || 'Échec de la mise à jour', 'error');
      else {
        toast(isPriority ? 'Chauffeur prioritaire : il recevra les courses en premier' : 'Chauffeur repassé en niveau normal', 'success');
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
          <p className="page-sub">Vérifiez les documents obligatoires, approuvez et gérez votre flotte. Les chauffeurs prioritaires reçoivent chaque course en premier.</p>
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
                <th>Documents</th>
                <th>Statut</th>
                <th>Priorité</th>
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
                    <button
                      className={`btn btn-sm ${d.documents?.canBeApproved ? 'btn-secondary' : 'btn-ghost'}`}
                      onClick={() => setDocsFor(d)}
                      title={d.documents?.problem || 'Dossier complet'}
                    >
                      <FileText size={14} /> {d.documents?.approved ?? 0}/{d.documents?.required ?? 10}
                    </button>
                  </td>
                  <td>
                    {d.isApproved ? (
                      d.isOnline
                        ? <span className="badge badge-success badge-dot">En ligne</span>
                        : <span className="badge badge-neutral badge-dot">Hors ligne</span>
                    ) : (
                      <span className="badge badge-warning badge-dot">En attente</span>
                    )}
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${d.isPriority ? 'btn-primary' : 'btn-secondary'}`}
                      disabled={busyId === d._id}
                      onClick={() => setPriority(d._id, !d.isPriority)}
                      aria-pressed={d.isPriority}
                      title={d.isPriority ? 'Reçoit les courses avant les autres chauffeurs' : 'Rendre prioritaire'}
                    >
                      <Star size={14} fill={d.isPriority ? 'currentColor' : 'none'} /> {d.isPriority ? 'Prioritaire' : 'Normal'}
                    </button>
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
                        disabled={busyId === d._id || !d.documents?.canBeApproved}
                        title={d.documents?.canBeApproved ? 'Approuver ce chauffeur' : 'Tous les documents obligatoires doivent être validés'}
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
      {docsFor && <DriverDocuments driver={docsFor} onClose={() => setDocsFor(null)} onChanged={load} />}
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
