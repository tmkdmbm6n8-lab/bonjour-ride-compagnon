import CloseControl from "@/components/ui/CloseControl";
import InvoiceRequest from '@/components/ride/InvoiceRequest';
import ReceiptDownload from '@/components/ride/ReceiptDownload';
import RideSafety from '@/components/ride/RideSafety';
import Link from '@/lib/archive-navigation';
import {createFileRoute} from '@tanstack/react-router';
import { drawableRoute } from '@/lib/utils/route-display';
import RiderLayout from '@/components/RiderLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from '@/lib/archive-navigation';
import { Circle, MapPin } from 'lucide-react';
import MapView from '@/components/ArchiveMap';
import { RideStatusBadge, Avatar, Stars, Loading, VEHICLE_LABELS, money } from '@/components/ui/bits';
import { formatDate, formatDistance, formatDuration } from '@/lib/utils/geo';
import { paymentMethodLabel } from '@/lib/vtc-pricing';

function RideDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/rides/${id}`);
        if (!res.ok) { if (!ignore) setNotFound(true); return; }
        const payload = await res.json();
        if (!ignore) setData(payload);
      } catch {
        if (!ignore) setNotFound(true);
      }
    })();
    return () => { ignore = true; };
  }, [id]);

  if (notFound) {
    return (
      <div className="content-pad">
        <p className="muted">Course introuvable.</p>
      </div>
    );
  }

  if (!data) return <div className="content-pad"><Loading /></div>;

  const { ride } = data;

  return (
    <div className="content-pad" style={{ maxWidth: 760 }}>
      <CloseControl className="mb-4" onClick={() => router.back()} label="Retour aux courses" />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="page-title">{VEHICLE_LABELS[ride.vehicleType]}</h1>
          <p className="page-sub">{formatDate(ride.createdAt)}</p>
        </div>
        <RideStatusBadge status={ride.status} />
      </div>

      <div className="card" style={{ height: 260, overflow: 'hidden', position: 'relative' }}>
        <MapView
          center={{ lat: ride.pickup.lat, lng: ride.pickup.lng }}
          pickup={{ lat: ride.pickup.lat, lng: ride.pickup.lng }}
          dropoff={{ lat: ride.dropoff.lat, lng: ride.dropoff.lng }}
          routeGeometry={drawableRoute(ride.route?.geometry)}
          fit
        />
      </div>

      <div className="card card-pad mt-4">
        <div className="flex-col gap-2 small">
          <div className="flex gap-2">
            <Circle size={14} style={{ marginTop: 3, color: 'var(--ink-950)', flexShrink: 0 }} />
            <span>{ride.pickup.address}</span>
          </div>
          <div className="flex gap-2">
            <MapPin size={14} style={{ marginTop: 3, color: 'var(--gold-600)', flexShrink: 0 }} />
            <span>{ride.dropoff.address}</span>
          </div>
        </div>
        <div className="flex gap-4 mt-3 tiny muted">
          <span>{formatDistance(ride.route?.distanceMeters || 0)}</span>
          <span>{formatDuration(ride.route?.durationSeconds || 0)}</span>
        </div>
      </div>

      {ride.driver && (
        <div className="card card-pad mt-4 flex items-center gap-3">
          <Avatar name={ride.driver.name} src={ride.driver.avatar} />
          <div className="flex-1">
            <div style={{ fontWeight: 700 }}>{ride.driver.name}</div>
            <Stars value={ride.driver.rating} />
          </div>
          <div className="text-right small muted">
            {ride.driver.vehicle?.color} {ride.driver.vehicle?.make} {ride.driver.vehicle?.model}
            <div className="badge badge-neutral mt-1">{ride.driver.vehicle?.plate}</div>
          </div>
        </div>
      )}

      {(ride.status === 'completed' || ride.fare?.cancellationFee > 0) && (
        <div className="card card-pad mt-4">
          <h3 className="small mb-3" style={{ fontWeight: 700 }}>Reçu</h3>
          <div className="flex-col gap-1 small">
            {ride.status === 'completed' ? (
              <>
                <Row label="Prise en charge" value={money(ride.fare.baseFare)} />
                <Row label="Distance" value={money(ride.fare.distanceFare)} />
                <Row label="Durée" value={money(ride.fare.timeFare)} />
                {ride.fare.surgeFare > 0 && <Row label={`Majoration ${ride.fare.surgeMultiplier}×`} value={money(ride.fare.surgeFare)} />}
                <Row label="Frais de réservation" value={money(ride.fare.bookingFee)} />
                {ride.fare.driverFloorSupplement > 0 && <Row label="Complément rémunération minimale chauffeur" value={money(ride.fare.driverFloorSupplement)} />}
                {ride.fare.discount > 0 && <Row label="Remise" value={`−${money(ride.fare.discount)}`} />}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                  <Row label={<b>Total ({paymentMethodLabel(ride.payment?.method)})</b>} value={<b>{money(ride.fare.total)}</b>} />
                </div>
              </>
            ) : (
              <Row label="Frais d’annulation" value={money(ride.fare.cancellationFee)} />
            )}
          </div>
        </div>
      )}

      <div className="card card-pad mt-4 flex-col gap-3">
        <ReceiptDownload ride={ride}/>
        <InvoiceRequest key={ride.id} ride={ride}/>
        <RideSafety ride={ride}/>
        <Link href={`/contact?topic=ride_issue&ride=${encodeURIComponent(ride.id)}`} className="btn btn-ghost btn-sm">Réclamation ou objet oublié</Link>
        <Link href={`/contact?topic=payments&ride=${encodeURIComponent(ride.id)}`} className="btn btn-ghost btn-sm">Question sur ce paiement ou demande de facture</Link>
      </div>

      {ride.rating?.byRider && (
        <div className="card card-pad mt-4">
          <h3 className="small mb-2" style={{ fontWeight: 700 }}>Votre note</h3>
          <Stars value={ride.rating.byRider} />
          {ride.rating.riderComment && <p className="small muted mt-2">“{ride.rating.riderComment}”</p>}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="muted">{label}</span>
      <span className="mono-nums">{value}</span>
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/rides/$id')({head:()=>({meta:[{title:"Détail de course · StrasDrive"},{name:'description',content:"StrasDrive — détail de course, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Détail de course · StrasDrive"},{property:'og:description',content:"StrasDrive — détail de course, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <RiderLayout><RideDetailPage/></RiderLayout>});
