import { useEffect, useState } from 'react';
import { Circle, MapPin, Car, Crown, Users, ArrowRight } from 'lucide-react';
import Link from '@/lib/archive-navigation';
import PlaceSearch from '@/components/maps/PlaceSearch';
import { VEHICLE_LABELS, money } from '@/components/ui/bits';
import { homeEstimate } from '@/lib/vtc.functions';
import { formatDuration } from '@/lib/utils/geo';

const ICONS = { economy: Car, comfort: Car, premium: Crown, xl: Users };

export default function HomeRideEstimator() {
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pickup || !dropoff) { setResult(null); return undefined; }
    let ignore = false;
    setLoading(true); setError('');
    homeEstimate({ data: { pickup, dropoff } })
      .then((r) => { if (!ignore) setResult(r); })
      .catch(() => { if (!ignore) setError('Impossible de calculer les tarifs pour le moment.'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = !result ? [] : result.source === 'uber'
    ? result.products.map((p) => ({ key: p.name, icon: Car, name: p.name, sub: [p.capacity ? `${p.capacity} places` : null, p.tripSeconds ? `${formatDuration(p.tripSeconds)} de trajet` : null, p.etaMinutes ? `chauffeur à ${p.etaMinutes} min` : null].filter(Boolean).join(' · '), price: p.price }))
    : Object.entries(result.estimates).map(([type, fare]) => ({ key: type, icon: ICONS[type] || Car, name: VEHICLE_LABELS[type], sub: `${formatDuration(result.route.durationSeconds)} de trajet`, price: fare.total }));

  return (
    <div className="card" style={{ marginTop: 40, padding: 24, maxWidth: 560, boxShadow: 'var(--shadow-lg)', borderRadius: 'var(--radius-xl)' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: 14 }}>Estimez le prix de votre course</h2>
      <div className="flex-col gap-3">
        <PlaceSearch value={pickupText} onChangeText={(t) => { setPickupText(t); if (pickup) setPickup(null); }}
          onSelect={(r) => { setPickup(r); setPickupText(r.address); }} committedValue={pickup?.address}
          placeholder="Point de départ" icon={Circle} />
        <PlaceSearch value={dropoffText} onChangeText={(t) => { setDropoffText(t); if (dropoff) setDropoff(null); }}
          onSelect={(r) => { setDropoff(r); setDropoffText(r.address); }} committedValue={dropoff?.address}
          placeholder="Point d’arrivée" icon={MapPin} />
      </div>
      {loading && <div className="flex items-center gap-2 mt-4 muted small"><span className="spinner" /> Calcul des tarifs…</div>}
      {error && <p className="small mt-4" style={{ color: 'var(--danger)' }}>{error}</p>}
      {!loading && rows.length > 0 && (
        <>
          <div className="flex-col gap-2 mt-4">
            {rows.map(({ key, icon: Icon, name, sub, price }) => (
              <div key={key} className="vehicle-row">
                <Icon size={22} style={{ color: 'var(--gold-600)', flexShrink: 0 }} />
                <span className="flex-1" style={{ minWidth: 0 }}>
                  <span className="small" style={{ display: 'block', fontWeight: 700 }}>{name}</span>
                  <span className="tiny muted truncate" style={{ display: 'block' }}>{sub}</span>
                </span>
                <span className="small mono-nums" style={{ fontWeight: 700 }}>{money(price)}</span>
              </div>
            ))}
          </div>
          <Link href="/signup" className="btn btn-primary btn-lg mt-4" style={{ width: '100%' }}>Réserver cette course <ArrowRight size={18} /></Link>
        </>
      )}
    </div>
  );
}
