import MapView from '@/components/ArchiveMap';

const validPoint = (point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng)
  && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;

/** Only map coordinates already returned in this specific admin record. */
export default function AdminRideMap({ pickup, dropoff, erased = false }) {
  if (erased || !validPoint(pickup) || !validPoint(dropoff)) {
    return <p className="tiny muted">Aperçu de la carte indisponible pour cette course.</p>;
  }
  return <div className="admin-ride-map" aria-label="Carte des points de prise en charge et de dépose">
    <MapView center={pickup} pickup={pickup} dropoff={dropoff} fit fitTo={[pickup, dropoff]} />
  </div>;
}
