'use client';
import { useEffect, useRef, useState } from 'react';
import { Banknote, CalendarClock, CreditCard, Flag, MapPin, Plane, TrainFront } from 'lucide-react';
import { useDriverActivity } from '@/context/DriverActivityProvider';
import { useSession } from '@/lib/archive-auth';
import { useRouter } from '@/lib/archive-navigation';
import { apiFetch } from '@/lib/archive-fetch';
import { watchRefresh } from '@/lib/live-refresh';
import { money, VEHICLE_LABELS } from '@/components/ui/bits';
import { formatDistance, formatDuration } from '@/lib/utils/geo';
import Modal from '@/components/ui/Modal';
import CloseControl from '@/components/ui/CloseControl';
import { useToast } from '@/components/ui/Toast';
import { startRinging, playSound } from '@/lib/sounds';
import { driverOfferActivity } from '@/lib/live-activity';
import { syncLiveActivity, stopLiveActivity } from '@/lib/live-activity-native';

export const RESERVATION_RESPONSE_SECONDS = 45;
export default function DriverIncomingOffer() {
  const { enabled, online, profile, loading, offer, ride, accept, decline } = useDriverActivity();
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [reservation, setReservation] = useState(null);
  const [busy, setBusy] = useState(false);
  const pendingAction = useRef(false);
  const handled = useRef(new Set());
  const [now, setNow] = useState(Date.now());
  const allowed = enabled && !loading && !ride && !profile?.isReportSuspended;
  const incoming = allowed ? offer || (online ? reservation : null) : null;
  const isReservation = Boolean(incoming && !incoming.rideId);
  const key = incoming ? `${incoming.rideId || incoming.id}:${incoming.phase || 'reservation'}` : null;
  const deadline = incoming ? isReservation ? incoming.deadline : incoming.expiresAt ? Date.parse(incoming.expiresAt) : incoming.receivedAt + Math.max(0, incoming.expiresInSeconds ?? 0) * 1000 : 0;
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const duration = isReservation ? RESERVATION_RESPONSE_SECONDS : Math.max(1, incoming?.expiresInSeconds || 45);

  useEffect(() => {
    handled.current = new Set();
    if (!session?.user?.id) return;
    try { handled.current = new Set(JSON.parse(localStorage.getItem(`strasdrive:handled-reservations:${session.user.id}`) || '[]')); } catch { /* optional local memory */ }
  }, [session?.user?.id]);
  const remember = (id) => {
    handled.current.add(id);
    try { localStorage.setItem(`strasdrive:handled-reservations:${session.user.id}`, JSON.stringify([...handled.current].slice(-250))); } catch { /* still remembered in this session */ }
  };
  useEffect(() => {
    if (!allowed || !online || offer) { setReservation(null); return; }
    return watchRefresh(async (active, signal) => {
      const response = await apiFetch('/api/drivers/me/advance-reservations', { signal });
      if (!response.ok) return;
      const data = await response.json();
      if (!active()) return;
      setReservation(current => {
        if (current && data.reservations?.some(item => item.id === current.id)) return current;
        const next = (data.reservations || []).find(item => !handled.current.has(item.id));
        return next ? { ...next, deadline: Date.now() + RESERVATION_RESPONSE_SECONDS * 1000 } : null;
      });
    }, 4000);
  }, [allowed, online, offer?.rideId, session?.user?.id]);

  useEffect(() => {
    if (!key) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [key]);
  useEffect(() => {
    if (!key) return;
    return startRinging('offer');
  }, [key]);
  useEffect(() => {
    const activity = enabled && !loading ? driverOfferActivity(offer) : null;
    if (activity) void syncLiveActivity(activity);
    else void stopLiveActivity('driver_offer');
  }, [enabled, loading, offer?.rideId, offer?.receivedAt, offer?.expiresInSeconds]);

  const dismiss = async () => {
    if (!incoming || pendingAction.current) return;
    if (isReservation) { remember(incoming.id); setReservation(null); }
    else await decline();
    // No navigation: the underlying page and its scroll position stay intact.
  };
  useEffect(() => {
    if (incoming && seconds === 0 && !busy) void dismiss();
  }, [key, seconds, busy]);
  const acceptIncoming = async () => {
    if (!incoming || pendingAction.current || seconds === 0) return;
    pendingAction.current = true; setBusy(true);
    try {
      if (isReservation) {
        const response = await apiFetch('/api/drivers/me/advance-reservations/accept', { method: 'POST', body: JSON.stringify({ id: incoming.id }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Réservation indisponible');
        remember(incoming.id); setReservation(null);
        router.push(`/driver/reservations?accepted=${encodeURIComponent(incoming.id)}`);
        toast('Réservation acceptée', 'success', 5000);
      } else {
        const acceptedRide = await accept();
        if (!acceptedRide) return;
        router.push('/driver/dashboard');
        playSound('driver-found');
      }
    } catch (error) { toast(error.message || 'Cette demande n’est plus disponible', 'error', 4500); }
    finally { pendingAction.current = false; setBusy(false); }
  };
  if (!incoming) return null;
  const price = isReservation ? incoming.estimated_price : incoming.profitability?.expectedEarnings ?? incoming.earnings;
  const payment = isReservation ? incoming.payment_method : incoming.paymentMethod;
  const scheduledAt = isReservation ? incoming.scheduled_at : incoming.scheduledAt;
  const pickup = isReservation ? incoming.pickup_address : incoming.pickup?.address;
  const dropoff = isReservation ? incoming.dropoff_address : incoming.dropoff?.address;
  const Icon = isReservation ? incoming.transport_type === 'flight' ? Plane : TrainFront : CalendarClock;
  return <Modal open portal fullScreen closable={false} onClose={dismiss} className="driver-incoming-modal">
    <section className="driver-incoming-card" aria-label={isReservation ? 'Nouvelle réservation' : 'Nouvelle course'}>
      <header className="driver-incoming-heading">
        <span><Icon size={20} />{isReservation ? 'Réservation' : incoming.airportReturn ? 'Course Gold' : VEHICLE_LABELS[incoming.rideClass] || 'Nouvelle course'}</span>
        <span className={`driver-incoming-payment ${payment === 'cash' ? 'is-cash' : ''}`} aria-label={payment === 'cash' ? 'Paiement en espèces' : payment === 'card' ? 'Paiement par carte' : 'Paiement portefeuille'}>
          {payment === 'cash' ? <Banknote size={25} /> : <CreditCard size={25} />}
        </span>
        <CloseControl onClick={dismiss} disabled={busy} label="Fermer la demande" />
      </header>
      <div className="driver-incoming-price"><span>{isReservation ? 'Tarif estimé' : 'Net chauffeur'}</span><strong>{price != null && Number.isFinite(Number(price)) ? money(Number(price)) : 'Non disponible'}</strong></div>
      {scheduledAt && <p className="driver-incoming-date">{new Date(scheduledAt).toLocaleString('fr-FR',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})}</p>}
      {!isReservation && <p className="driver-incoming-approach">Prise en charge à {incoming.etaMinutes ?? '—'} min · {formatDistance(incoming.distanceToPickupMeters)}</p>}
      <div className="driver-incoming-address"><MapPin size={17} /><div><small>Départ</small><p>{pickup}</p></div></div>
      <div className="driver-incoming-address is-destination"><Flag size={17} /><div><small>Arrivée</small><p>{dropoff}</p></div></div>
      {!isReservation && <p className="driver-incoming-distance">{formatDistance(incoming.distanceMeters)} · {formatDuration(incoming.durationSeconds)}</p>}
      <div className="driver-incoming-actions">
        <button type="button" className="driver-incoming-refuse" onClick={dismiss} disabled={busy}>Refuser</button>
        <button type="button" className="driver-incoming-accept" onClick={acceptIncoming} disabled={busy || seconds === 0}>
          <span aria-hidden="true" className="driver-incoming-progress" style={{width:`${Math.min(100, seconds / duration * 100)}%`}} />
          <span>{busy ? 'Validation…' : `Accepter · ${seconds} s`}</span>
        </button>
      </div>
    </section>
  </Modal>;
}
