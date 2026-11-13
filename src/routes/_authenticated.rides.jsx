import {createFileRoute} from '@tanstack/react-router';
import RiderLayout from '@/components/RiderLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useState } from 'react';
import Link from '@/lib/archive-navigation';
import { Circle, MapPin, ChevronRight, Car } from 'lucide-react';
import { RideStatusBadge, Empty, Loading, VEHICLE_LABELS, money } from '@/components/ui/bits';
import { formatDate } from '@/lib/utils/geo';

const FILTERS = [
  { key: '', label: 'Tous' },
  { key: 'completed', label: 'Terminée' },
  { key: 'cancelled', label: 'Annulée' },
];

function RidesPage() {
  const [rides, setRides] = useState(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    let ignore = false;
    setRides(null);
    (async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: '15' });
        if (filter) params.set('status', filter);
        const res = await fetch(`/api/rides?${params}`);
        const data = await res.json();
        if (!ignore && res.ok) {
          setRides(data.rides);
          setPagination(data.pagination);
        }
      } catch {
        if (!ignore) setRides([]);
      }
    })();
    return () => { ignore = true; };
  }, [filter, page]);

  return (
    <div className="content-pad">
      <h1 className="page-title">Mes courses</h1>
      <p className="page-sub mb-6">Toutes vos courses avec StrasDrive</p>

      <div className="segmented mb-6" role="tablist">
        {FILTERS.map((f) => ( <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            className={filter === f.key ? 'active' : ''}
            onClick={() => { setFilter(f.key); setPage(1); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rides === null && <Loading label="Chargement de vos courses…" />}

      {rides?.length === 0 && (
        <Empty
          icon={Car}
          title="Aucune course pour le moment"
          hint="Vos trajets apparaîtront ici après votre première réservation."
          action={<Link href="/dashboard" className="btn btn-primary mt-2">Réserver une course</Link>}
        />
      )}

      <div className="flex-col gap-3">
        {rides?.map((ride) => ( <Link key={ride._id} href={`/rides/${ride._id}`} className="card card-pad card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="tiny muted">{formatDate(ride.createdAt)}</span>
              <RideStatusBadge status={ride.status} />
            </div>
            <div className="flex-col gap-1 small">
              <div className="flex gap-2 items-center">
                <Circle size={12} style={{ color: 'var(--ink-950)', flexShrink: 0 }} />
                <span className="truncate">{ride.pickup?.address}</span>
              </div>
              <div className="flex gap-2 items-center">
                <MapPin size={12} style={{ color: 'var(--gold-600)', flexShrink: 0 }} />
                <span className="truncate">{ride.dropoff?.address}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3" style={{ borderTop: '1px solid var(--ink-100)', paddingTop: 10 }}>
              <span className="tiny muted">{VEHICLE_LABELS[ride.vehicleType] || ride.vehicleType}</span>
              <span className="flex items-center gap-1 small" style={{ fontWeight: 700 }}>
                {ride.status === 'completed' ? money(ride.fare?.total) : ride.status === 'cancelled' && ride.fare?.cancellationFee > 0 ? money(ride.fare.cancellationFee) : '—'}
                <ChevronRight size={15} style={{ color: 'var(--ink-400)' }} />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}> Précédent </button>
          <span className="small muted" style={{ alignSelf: 'center' }}>
            {page} / {pagination.pages}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}> Suivant </button>
        </div>
      )}
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/rides')({head:()=>({meta:[{title:"Mes courses · StrasDrive"},{name:'description',content:"StrasDrive — mes courses, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Mes courses · StrasDrive"},{property:'og:description',content:"StrasDrive — mes courses, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <RiderLayout><RidesPage/></RiderLayout>});
