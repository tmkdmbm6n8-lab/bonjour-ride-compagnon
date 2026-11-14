import {createFileRoute} from '@tanstack/react-router';
import RiderLayout from '@/components/RiderLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Navigation, MapPin, Circle, Car, Crown, Users, Zap, Wallet, Banknote,
  MessageCircle, X, ShieldCheck, Copy, TrendingUp,
} from 'lucide-react';
import Link from '@/lib/archive-navigation';
import MapView from '@/components/ArchiveMap';
import PlaceSearch from '@/components/maps/PlaceSearch';
import ChatSheet from '@/components/ride/ChatSheet';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Avatar, Stars, StarPicker, VEHICLE_LABELS, money } from '@/components/ui/bits';
import useRiderRide from '@/hooks/useRiderRide';
import { bookingPaymentProblem, paymentMethodLabel } from '@/lib/vtc-pricing';
import { playSound } from '@/lib/sounds';
import useVisualViewport from '@/hooks/useVisualViewport';
import { haversineDistance } from '@/lib/utils/geo';
import useGeolocation from '@/hooks/useGeolocation';
import { formatDistance, formatDuration, roadDistanceMeters, etaMinutes as etaFor } from '@/lib/utils/geo';

const VEHICLE_META = {
  economy: { icon: Car, blurb: 'Des courses au quotidien à prix avantageux' },
  comfort: { icon: Car, blurb: 'Voitures récentes, plus d’espace pour les jambes' },
  premium: { icon: Crown, blurb: 'Chauffeurs les mieux notés, voitures de luxe' },
  xl: { icon: Users, blurb: 'Jusqu’à 6 places' },
};

const CANCEL_REASONS = [
  'Le chauffeur met trop de temps',
  'Réservation faite par erreur',
  'Mes plans ont changé',
  'J’ai trouvé un autre moyen de transport',
];

function RiderDashboard() {
  const toast = useToast();
  const { position: geo, error: geoError } = useGeolocation({ watch: false });

  // Booking form state
  const [pickup, setPickup] = useState(null); // {address, lat, lng}
  const [dropoff, setDropoff] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('wallet'); // 'wallet' | 'cash'
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [estimate, setEstimate] = useState(null); // {route, estimates}
  const [estimating, setEstimating] = useState(false);
  const [vehicleType, setVehicleType] = useState('economy');
  const [walletBalance, setWalletBalance] = useState(null);
  const [booking, setBooking] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [availability, setAvailability] = useState(null); // {economy:{count,etaMinutes},…}
  const [chatOpen, setChatOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [unread, setUnread] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const blurTimerRef = useRef(null);
  const onSearchFocus = useCallback((focused) => {
    clearTimeout(blurTimerRef.current);
    if (focused) setSearchFocused(true);
    else blurTimerRef.current = setTimeout(() => setSearchFocused(false), 150);
  }, []);
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const vv = useVisualViewport(isPhone && searchFocused);
  const chatOpenRef = useRef(false);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  const onRideEvent = useCallback((type, data) => {
    const sound = { accepted: 'driver-found', arrived: 'arrived', started: 'started', 'driver-cancelled': 'cancelled', 'no-drivers': 'cancelled', completed: 'completed' }[type];
    if (sound) playSound(sound);
    if (type === 'message' && data?.from === 'driver') playSound('message');
    if (type === 'accepted') toast('Chauffeur trouvé — il est en route !', 'success');
    if (type === 'arrived') toast('Votre chauffeur est arrivé', 'success', 5000);
    if (type === 'started') toast('Course démarrée — bon trajet', 'info');
    if (type === 'no-drivers') toast('Aucun chauffeur disponible pour le moment. Veuillez réessayer dans quelques instants.', 'error', 5000);
    if (type === 'driver-cancelled') toast('Le chauffeur a annulé — nous vous en cherchons un autre…', 'info', 5000);
    if (type === 'completed' && data?.shortfall) {
      toast('Votre portefeuille est devenu débiteur — rechargez-le pour réserver votre prochaine course', 'info', 8000);
    }
    if (type === 'message' && data?.from === 'driver' && !chatOpenRef.current) {
      setUnread((u) => u + 1);
    }
  }, [toast]);

  const {
    phase, ride, driverPosition, etaMinutes, offersSent,
    completedRide, clearCompleted, loadingActive, book, cancel, rate,
  } = useRiderRide({ onEvent: onRideEvent });

  // ── Wallet balance ──
  const refreshWallet = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const { user } = await res.json();
        setWalletBalance(user.wallet?.balance ?? 0);
      }
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => { refreshWallet(); }, [refreshWallet]);

  // ── Default pickup = current location (reverse geocoded) ──
  useEffect(() => {
    if (!geo || pickup) return;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/geo/search?reverse=1&lat=${geo.lat}&lng=${geo.lng}`);
        const data = await res.json();
        const place = data.results?.[0];
        if (!ignore) {
          const address = place?.address || 'Position actuelle';
          setPickup({ address, lat: geo.lat, lng: geo.lng });
          setPickupText(address);
        }
      } catch {
        if (!ignore) {
          setPickup({ address: 'Position actuelle', lat: geo.lat, lng: geo.lng });
          setPickupText('Position actuelle');
        }
      }
    })();
    return () => { ignore = true; };
  }, [geo, pickup]);

  // ── Nearby drivers (idle only, 10s poll) ──
  useEffect(() => {
    if (phase !== 'idle' || !pickup) { setNearby([]); setAvailability(null); return undefined; }
    let timer;
    let stopped = false;
    async function load() {
      try {
        const res = await fetch(`/api/drivers/nearby?lat=${pickup.lat}&lng=${pickup.lng}`);
        if (res.ok) {
          const data = await res.json();
          if (!stopped) { setNearby(data.drivers || []); setAvailability(data.availability || null); }
        }
      } catch { /* ignore */ }
      timer = setTimeout(load, 10000);
    }
    load();
    return () => { stopped = true; clearTimeout(timer); };
  }, [phase, pickup?.lat, pickup?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fare estimate when both points set ──
  useEffect(() => {
    if (!pickup || !dropoff) { setEstimate(null); return undefined; }
    let ignore = false;
    setEstimating(true);
    (async () => {
      try {
        const res = await fetch('/api/rides/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickup: { lat: pickup.lat, lng: pickup.lng },
            dropoff: { lat: dropoff.lat, lng: dropoff.lng },
          }),
        });
        const data = await res.json();
        if (!ignore && res.ok) setEstimate(data);
      } catch {
        if (!ignore) toast('Impossible d’estimer le tarif — vérifiez votre connexion', 'error');
      } finally {
        if (!ignore) setEstimating(false);
      }
    })();
    return () => { ignore = true; };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Book ──
  async function handleBook() {
    if (!pickup || !dropoff || booking) return;
    setBooking(true);
    try {
      await book({ pickup, dropoff, vehicleType, paymentMethod });
      setUnread(0);
    } catch (err) {
      toast(err.message, 'error', 5000);
    } finally {
      setBooking(false);
    }
  }

  async function handleCancel(reason) {
    setCancelling(true);
    try {
      await cancel(reason);
      setCancelOpen(false);
      toast('Course annulée', 'info');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCancelling(false);
    }
  }

  async function handleRate() {
    if (!completedRide || !rating || submittingRating) return;
    setSubmittingRating(true);
    try {
      await rate(completedRide.id, rating, ratingComment);
      toast('Merci pour votre avis !', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmittingRating(false);
      clearCompleted();
      setRating(0);
      setRatingComment('');
      refreshWallet();
    }
  }

  // Live distance + ETA, recomputed from the driver's streamed GPS position.
  // Before pickup it tracks driver→pickup; during the trip, driver→dropoff.
  const liveTrip = useMemo(() => {
    if (phase !== 'active' || !ride || !driverPosition) return null;
    const target =
      ride.status === 'in_progress'
        ? { lat: ride.dropoff.lat, lng: ride.dropoff.lng }
        : { lat: ride.pickup.lat, lng: ride.pickup.lng };
    const meters = roadDistanceMeters(driverPosition, target);
    return {
      meters,
      minutes: etaFor(meters),
      toDestination: ride.status === 'in_progress',
    };
  }, [phase, ride, driverPosition]);

  const selectedFare = estimate?.estimates?.[vehicleType];
  const surge = selectedFare?.surgeMultiplier > 1;
  const selectedAvailability = availability?.[vehicleType];
  const noDriverForSelected = selectedAvailability != null && selectedAvailability.count === 0;
  const insufficientWallet =
    walletBalance != null && selectedFare && Boolean(bookingPaymentProblem(paymentMethod, walletBalance, selectedFare.total));

  const mapProps = useMemo(() => {
    if (phase === 'active' && ride) {
      const beforePickup = ride.status !== 'in_progress';
      const p = { lat: ride.pickup.lat, lng: ride.pickup.lng };
      return {
        pickup: p,
        dropoff: { lat: ride.dropoff.lat, lng: ride.dropoff.lng },
        routeGeometry: ride.status === 'in_progress' ? ride.route?.geometry : undefined,
        driverPosition,
        fit: true,
        // Before pickup, zoom on the driver coming to the rider
        fitTo: beforePickup && driverPosition ? [p, driverPosition] : undefined,
        fitKey: `${ride.status}|${driverPosition ? 'd' : '-'}`,
      };
    }
    // Once an address is set, frame the nearby available drivers around it
    const close = pickup
      ? nearby.filter((d) => d.location && haversineDistance(pickup, d.location) <= 15000).map((d) => d.location)
      : [];
    return {
      pickup: pickup ? { lat: pickup.lat, lng: pickup.lng } : undefined,
      dropoff: dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : undefined,
      routeGeometry: estimate?.route?.geometry,
      drivers: nearby,
      userPosition: geo || undefined,
      fit: Boolean(pickup),
      fitTo: pickup ? [pickup, dropoff, ...close, ...(dropoff && estimate?.route?.geometry ? estimate.route.geometry.map(([lng, lat]) => ({ lat, lng })) : [])].filter(Boolean) : undefined,
      fitKey: `${pickup?.lat},${pickup?.lng}|${dropoff?.lat},${dropoff?.lng}|${estimate ? 'r' : '-'}|${nearby.map((d) => d.id).sort().join(',')}`,
    };
  }, [phase, ride, driverPosition, pickup, dropoff, estimate, nearby, geo]);

  const center = geo || { lat: 40.7128, lng: -74.006 };

  return (
    <div className="ride-page">
      <div className="map-fill">
        <MapView center={center} zoom={13} {...mapProps} />
      </div>

      <div
        className="ride-panel"
        style={vv ? { position: 'fixed', top: vv.top + 8, bottom: 'auto', maxHeight: vv.height - 16, zIndex: 45 } : undefined}
      >
        {/* ── IDLE: booking form ── */}
        {phase === 'idle' && !loadingActive && (
          <div className="card card-pad animate-in">
            <h2 style={{ fontSize: '1.25rem', marginBottom: 14 }}>Où allez-vous ?</h2>

            {geoError && !pickup && (
              <p className="tiny muted mb-3"> L’accès à la localisation est désactivé — recherchez plutôt votre point de prise en charge. </p>
            )}

            <div className="flex-col gap-3">
              <PlaceSearch
                value={pickupText}
                onChangeText={(t) => { setPickupText(t); if (pickup) setPickup(null); }}
                onSelect={(r) => { setPickup(r); setPickupText(r.address); }}
                committedValue={pickup?.address}
                placeholder="Lieu de prise en charge"
                onFocusChange={onSearchFocus}
                icon={Circle}
                bias={geo || undefined}
              />
              <PlaceSearch
                value={dropoffText}
                onChangeText={(t) => { setDropoffText(t); if (dropoff) setDropoff(null); }}
                onSelect={(r) => { setDropoff(r); setDropoffText(r.address); }}
                committedValue={dropoff?.address}
                placeholder="Quelle est votre destination ?"
                onFocusChange={onSearchFocus}
                icon={MapPin}
                bias={geo || undefined}
                autoFocus={Boolean(pickup)}
              />
            </div>

            {estimating && (
              <div className="flex items-center gap-2 mt-4 muted small">
                <span className="spinner" /> Calcul des tarifs… </div>
            )}

            {estimate && !estimating && (
              <>
                <div className="flex items-center justify-between mt-4 mb-2">
                  <span className="tiny muted">
                    {formatDistance(estimate.route.distanceMeters)} · {formatDuration(estimate.route.durationSeconds)}
                  </span>
                  {surge && (
                    <span className="badge badge-warning">
                      <TrendingUp size={12} /> {selectedFare.surgeMultiplier}× demande
                    </span>
                  )}
                </div>

                <div className="flex-col gap-2">
                  {Object.entries(estimate.estimates).map(([type, fare]) => {
                    const Meta = VEHICLE_META[type];
                    const avail = availability?.[type];
                    return (
                      <button
                        key={type}
                        className={`vehicle-row ${vehicleType === type ? 'selected' : ''}`}
                        onClick={() => setVehicleType(type)}
                        aria-pressed={vehicleType === type}
                      >
                        <Meta.icon size={22} style={{ color: vehicleType === type ? 'var(--gold-600)' : 'var(--ink-400)', flexShrink: 0 }} />
                        <span className="flex-1" style={{ minWidth: 0 }}>
                          <span className="small" style={{ display: 'block', fontWeight: 700 }}>
                            {VEHICLE_LABELS[type]}
                          </span>
                          <span className="tiny muted truncate" style={{ display: 'block' }}>{Meta.blurb}</span>
                          {avail && (
                            <span className="tiny truncate" style={{ display: 'block', fontWeight: 600, color: avail.count ? 'var(--success)' : 'var(--danger)' }}>
                              {avail.count
                                ? `${avail.count} chauffeur${avail.count > 1 ? 's' : ''} disponible${avail.count > 1 ? 's' : ''}${avail.etaMinutes ? ` · ${avail.etaMinutes} min` : ''}`
                                : 'Aucun chauffeur disponible'}
                            </span>
                          )}
                        </span>
                        <span className="flex-col" style={{ alignItems: 'flex-end' }}>
                          <span className="small mono-nums" style={{ fontWeight: 700 }}>{money(fare.total)}</span>
                          {fare.discount > 0 && (
                            <span className="tiny muted mono-nums" style={{ textDecoration: 'line-through' }}>{money(fare.originalTotal)}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedFare?.discount > 0 && (
                  <div className="flex items-center justify-between mt-4 tiny">
                    <span style={{ fontWeight: 600 }}>Remise de {Math.round(selectedFare.discountRate * 100)} % appliquée</span>
                    <span className="mono-nums">−{money(selectedFare.discount)}</span>
                  </div>
                )}

                {selectedFare?.driverFloorSupplement > 0 && (
                  <div className="flex items-center justify-between mt-4 tiny muted">
                    <span>Inclut le complément de rémunération minimale du chauffeur</span>
                    <span className="mono-nums">+{money(selectedFare.driverFloorSupplement)}</span>
                  </div>
                )}

                {/* Payment — wallet or cash */}
                <div className="flex gap-2 mt-4" role="radiogroup" aria-label="Mode de paiement">
                  {[
                    { id: 'wallet', icon: Wallet, label: 'Portefeuille', detail: walletBalance != null ? money(walletBalance) : '—' },
                    { id: 'cash', icon: Banknote, label: 'Espèces', detail: '' },
                  ].map(({ id, icon: Icon, label, detail }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={paymentMethod === id}
                      onClick={() => setPaymentMethod(id)}
                      className="flex-1 flex items-center justify-between"
                      style={{
                        padding: '10px 14px', background: 'var(--ink-50)', borderRadius: 12, cursor: 'pointer',
                        border: `2px solid ${paymentMethod === id ? 'var(--ink-900)' : 'transparent'}`,
                      }}
                    >
                      <span className="flex items-center gap-2 tiny" style={{ fontWeight: 600 }}>
                        <Icon size={16} /> {label}
                      </span>
                      <span className="tiny mono-nums muted">{detail}</span>
                    </button>
                  ))}
                </div>
                {paymentMethod === 'cash' && selectedFare && (
                  <p className="tiny muted mt-2">
                    Vous réglerez {money(selectedFare.total)} en espèces directement au chauffeur à la fin de la course.
                  </p>
                )}

                {insufficientWallet && (
                  <p className="tiny mt-2" style={{ color: 'var(--danger)' }}>
                    Solde du portefeuille insuffisant —{' '}
                    <Link href="/wallet" style={{ fontWeight: 700, textDecoration: 'underline' }}> ajoutez des fonds </Link>{' '}
                    pour réserver cette course.
                  </p>
                )}

                <button
                  className="btn btn-primary btn-lg btn-full mt-4"
                  onClick={handleBook}
                  disabled={booking || insufficientWallet || noDriverForSelected}
                >
                  {booking ? <span className="spinner" /> : noDriverForSelected ? (
                    <>Aucun chauffeur {VEHICLE_LABELS[vehicleType]} disponible</>
                  ) : (
                    <>Réserver {VEHICLE_LABELS[vehicleType]} · {money(selectedFare?.total || 0)}</>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── SEARCHING ── */}
        {phase === 'searching' && (
          <div className="card card-pad animate-in text-center">
            <div className="pulse-ring" style={{ width: 64, height: 64, margin: '12px auto 20px', borderRadius: '50%', background: 'var(--ink-950)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car size={26} color="#fff" />
            </div>
            <h3 style={{ fontSize: '1.15rem' }}>Recherche de votre chauffeur…</h3>
            <p className="small muted mt-1">
              {offersSent > 0
                ? `Nous contactons les chauffeurs à proximité (${offersSent} contactés)`
                : 'Nous contactons les chauffeurs proches de votre point de prise en charge'}
            </p>
            <button
              className="btn btn-secondary btn-full mt-6"
              onClick={() => setCancelOpen(true)}
            > Annuler la demande </button>
          </div>
        )}

        {/* ── ACTIVE ── */}
        {phase === 'active' && ride && (
          <div className="card card-pad animate-in">
            <div className="flex items-center justify-between mb-3 wrap gap-2">
              <span className={`badge badge-dot ${ride.status === 'in_progress' ? 'badge-info' : 'badge-gold'}`}>
                {ride.status === 'accepted' &&
                  (liveTrip
                    ? `Chauffeur à ${liveTrip.minutes} min`
                    : etaMinutes
                      ? `Arrivée du chauffeur dans ~${etaMinutes} min`
                      : 'Chauffeur en route')}
                {ride.status === 'arrived' && 'Votre chauffeur est là'}
                {ride.status === 'in_progress' &&
                  (liveTrip ? `${liveTrip.minutes} min jusqu’à destination` : 'En route vers la destination')}
              </span>
              {liveTrip && (
                <span className="tiny muted mono-nums">
                  {formatDistance(liveTrip.meters)} {liveTrip.toDestination ? 'restants' : 'de distance'}
                </span>
              )}
            </div>

            {/* Live trip progress */}
            {liveTrip && (
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--ink-100)',
                  overflow: 'hidden',
                  marginBottom: 14,
                }}
                aria-hidden="true"
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: 2,
                    background: 'linear-gradient(90deg, var(--ink-900), var(--gold-600))',
                    width: `${Math.max(
                      4,
                      Math.min(
                        96,
                        liveTrip.toDestination
                          ? 100 - (liveTrip.meters / Math.max(1, ride.route?.distanceMeters || 1)) * 100
                          : 100 - Math.min(100, (liveTrip.meters / 3000) * 100)
                      )
                    )}%`,
                    transition: 'width 900ms var(--ease)',
                  }}
                />
              </div>
            )}

            {ride.driver && (
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={ride.driver.name} src={ride.driver.avatar} size="lg" />
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }} className="truncate">{ride.driver.name}</div>
                  <div className="flex items-center gap-2">
                    <Stars value={ride.driver.rating} />
                    <span className="tiny muted">{ride.driver.totalTrips} courses</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="small" style={{ fontWeight: 700 }}>
                    {ride.driver.vehicle?.color} {ride.driver.vehicle?.make} {ride.driver.vehicle?.model}
                  </div>
                  <div className="badge badge-neutral mono-nums" style={{ marginTop: 4 }}>
                    {ride.driver.vehicle?.plate}
                  </div>
                </div>
              </div>
            )}

            {(ride.status === 'accepted' || ride.status === 'arrived') && ride.pin && (
              <div
                className="flex items-center justify-between card-pad mb-4"
                style={{ background: 'var(--gold-50)', borderRadius: 12, padding: '12px 16px' }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} style={{ color: 'var(--gold-700)' }} />
                  <span className="small" style={{ fontWeight: 600 }}>Votre code PIN</span>
                </div>
                <button
                  className="flex items-center gap-2"
                  onClick={() => { navigator.clipboard?.writeText(ride.pin); toast('Code PIN copié', 'info', 1500); }}
                  aria-label="Copier le code PIN"
                  style={{ fontWeight: 800, fontSize: '1.3rem', letterSpacing: '0.25em', color: 'var(--gold-700)' }}
                >
                  {ride.pin} <Copy size={14} />
                </button>
              </div>
            )}

            <div className="flex-col gap-2 small" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="flex gap-2">
                <Circle size={14} style={{ marginTop: 4, color: 'var(--ink-950)', flexShrink: 0 }} />
                <span className="truncate muted">{ride.pickup.address}</span>
              </div>
              <div className="flex gap-2">
                <MapPin size={14} style={{ marginTop: 4, color: 'var(--gold-600)', flexShrink: 0 }} />
                <span className="truncate muted">{ride.dropoff.address}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="muted">Course</span>
                <span className="mono-nums">
                  {formatDistance(ride.route?.distanceMeters || 0)} ·{' '}
                  {formatDuration(ride.route?.durationSeconds || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="muted">Tarif (portefeuille)</span>
                <span className="mono-nums" style={{ fontWeight: 700 }}>{money(ride.fare?.total)}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => { setChatOpen(true); setUnread(0); }}
                style={{ position: 'relative' }}
              >
                <MessageCircle size={17} /> Discussion
                {unread > 0 && (
                  <span
                    className="badge badge-danger"
                    style={{ position: 'absolute', top: -6, right: -4, minWidth: 20, justifyContent: 'center', padding: '1px 6px' }}
                  >
                    {unread}
                  </span>
                )}
              </button>
              {ride.status !== 'in_progress' && (
                <button className="btn btn-danger flex-1" onClick={() => setCancelOpen(true)}>
                  <X size={17} /> Annuler </button>
              )}
            </div>

            {ride.status === 'arrived' && (
              <p className="tiny muted mt-3 text-center"> Une annulation maintenant entraîne des frais d’annulation tardive de 3,00 € </p>
            )}
          </div>
        )}

        {loadingActive && (
          <div className="card card-pad">
            <div className="skeleton" style={{ height: 22, width: '55%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 46, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 46 }} />
          </div>
        )}
      </div>

      {/* Chat */}
      {phase === 'active' && ride && (
        <ChatSheet
          rideId={ride.id}
          role="rider"
          messages={ride.messages || []}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          counterpartName={ride.driver?.name}
        />
      )}

      {/* Cancel confirm */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Annuler cette course ?">
        <div className="flex-col gap-2">
          {CANCEL_REASONS.map((r) => ( <button
              key={r}
              className="vehicle-row"
              onClick={() => handleCancel(r)}
              disabled={cancelling}
            >
              <span className="small">{r}</span>
            </button>
          ))}
          <button className="btn btn-danger btn-full mt-2" onClick={() => handleCancel('')} disabled={cancelling}>
            {cancelling ? <span className="spinner" /> : 'Annuler sans motif'}
          </button>
          <button className="btn btn-ghost btn-full" onClick={() => setCancelOpen(false)}> Conserver ma course </button>
        </div>
      </Modal>

      {/* Receipt + rating */}
      <Modal
        open={Boolean(completedRide)}
        onClose={() => { clearCompleted(); refreshWallet(); }}
        title="Course terminée"
      >
        {completedRide && (
          <div className="flex-col gap-4">
            <div className="card card-pad" style={{ background: 'var(--ink-50)', border: 'none' }}>
              <div className="flex items-center justify-between small">
                <span className="muted">Prise en charge + distance + durée</span>
                <span className="mono-nums">
                  {money((completedRide.fare?.baseFare || 0) + (completedRide.fare?.distanceFare || 0) + (completedRide.fare?.timeFare || 0))}
                </span>
              </div>
              {completedRide.fare?.surgeFare > 0 && (
                <div className="flex items-center justify-between small mt-1">
                  <span className="muted">Majoration ({completedRide.fare.surgeMultiplier}×)</span>
                  <span className="mono-nums">{money(completedRide.fare.surgeFare)}</span>
                </div>
              )}
              <div className="flex items-center justify-between small mt-1">
                <span className="muted">Frais de réservation</span>
                <span className="mono-nums">{money(completedRide.fare?.bookingFee)}</span>
              </div>
              {completedRide.fare?.driverFloorSupplement > 0 && (
                <div className="flex items-center justify-between small mt-1">
                  <span className="muted">Complément rémunération minimale chauffeur</span>
                  <span className="mono-nums">{money(completedRide.fare.driverFloorSupplement)}</span>
                </div>
              )}
              {completedRide.fare?.discount > 0 && (
                <div className="flex items-center justify-between small mt-1">
                  <span className="muted">Remise ({Math.round((completedRide.fare.discountRate || 0) * 100)} %)</span>
                  <span className="mono-nums">−{money(completedRide.fare.discount)}</span>
                </div>
              )}
              <div
                className="flex items-center justify-between mt-2"
                style={{ borderTop: '1px solid var(--border)', paddingTop: 10, fontWeight: 700 }}
              >
                <span>Total ({paymentMethodLabel(completedRide.payment?.method)})</span>
                <span className="mono-nums">{money(completedRide.fare?.total)}</span>
              </div>
            </div>

            {completedRide.shortfall && (
              <p className="small" style={{ color: 'var(--warning)', fontWeight: 600 }}> Le montant de cette course a dépassé le solde de votre portefeuille. Rechargez-le pour régler le montant dû avant votre prochaine course. </p>
            )}

            <div className="text-center">
              <p className="small muted mb-2">Comment s’est passée votre course{completedRide.driver ? ` with ${completedRide.driver.name}` : ''}?</p>
              <StarPicker value={rating} onChange={setRating} />
              {rating > 0 && (
                <textarea
                  className="input mt-3"
                  placeholder="Laisser un commentaire (facultatif)"
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  maxLength={500}
                  rows={2}
                />
              )}
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={rating > 0 ? handleRate : () => { clearCompleted(); refreshWallet(); }}
              disabled={submittingRating}
            >
              {submittingRating ? <span className="spinner" /> : rating > 0 ? 'Envoyer la note' : 'Terminé'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/dashboard')({head:()=>({meta:[{title:"Réserver une course · StrasDrive"},{name:'description',content:"StrasDrive — réserver une course, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Réserver une course · StrasDrive"},{property:'og:description',content:"StrasDrive — réserver une course, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <RiderLayout><RiderDashboard/></RiderLayout>});
