import {createFileRoute} from '@tanstack/react-router';
import DriverLayout from '@/components/DriverLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useState } from 'react';
import { Circle, MapPin, Car } from 'lucide-react';
import { RideStatusBadge, Empty, Loading, money } from '@/components/ui/bits';
import { formatDate } from '@/lib/utils/geo';

function DriverTripsPage() {
  const [rides, setRides] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    let ignore = false;
    setRides(null);
    (async () => {
      try {
        const res = await fetch(`/api/rides?page=${page}&limit=15`);
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
  }, [page]);

  return (
    <div className="content-pad" style={{ maxWidth: 760 }}>
      <h1 className="page-title">Courses</h1>
      <p className="page-sub mb-6">Votre historique de courses</p>

      {rides === null && <Loading label="Chargement des courses…" />}
      {rides?.length === 0 && (
        <Empty icon={Car} title="Aucune course pour le moment" hint="Les courses acceptées apparaîtront ici." />
      )}

      <div className="flex-col gap-3">
        {rides?.map((ride) => ( <div key={ride._id} className="card card-pad">
            <div className="flex items-center justify-between mb-3">
              <span className="tiny muted">{formatDate(ride.createdAt)}</span>
              <RideStatusBadge status={ride.status} />
            </div>
            <div className="flex-col gap-1 small">
              <div className="flex gap-2 items-center">
                <Circle size={12} style={{ flexShrink: 0 }} />
                <span className="truncate">{ride.pickup?.address}</span>
              </div>
              <div className="flex gap-2 items-center">
                <MapPin size={12} style={{ color: 'var(--gold-600)', flexShrink: 0 }} />
                <span className="truncate">{ride.dropoff?.address}</span>
              </div>
            </div>
            {ride.status === 'completed' && (
              <div className="flex items-center justify-between mt-3" style={{ borderTop: '1px solid var(--ink-100)', paddingTop: 10 }}>
                <span className="tiny muted">Vous avez gagné</span>
                <span className="small mono-nums" style={{ fontWeight: 700, color: 'var(--success)' }}>
                  +{money(ride.fare?.driverEarnings)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}> Précédent </button>
          <span className="small muted" style={{ alignSelf: 'center' }}>{page} / {pagination.pages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}> Suivant </button>
        </div>
      )}
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/driver/trips')({head:()=>({meta:[{title:"Historique chauffeur · StrasDrive"},{name:'description',content:"StrasDrive — historique chauffeur, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Historique chauffeur · StrasDrive"},{property:'og:description',content:"StrasDrive — historique chauffeur, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <DriverLayout><DriverTripsPage/></DriverLayout>});
