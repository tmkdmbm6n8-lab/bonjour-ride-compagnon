import {createFileRoute} from '@tanstack/react-router';
import DriverLayout from '@/components/DriverLayout';
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/lib/archive-navigation';
import {
  Power, Navigation, MapPin, Circle, MessageCircle, X, Car,
  TrendingUp, CheckCircle2, KeyRound, Flag,
} from 'lucide-react';
import MapView from '@/components/ArchiveMap';
import ChatSheet from '@/components/ride/ChatSheet';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { money } from '@/components/ui/bits';
import useDriverState from '@/hooks/useDriverState';
import { formatDistance, formatDuration, roadDistanceMeters, etaMinutes as etaFor } from '@/lib/utils/geo';

function DriverDashboard() {
  const toast = useToast();
  const [chatOpen, setChatOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [unread, setUnread] = useState(0);

  const onEvent = useCallback((type, data) => {
    if (type === 'offer-expired') toast('Demande expirée', 'info', 2500);
    if (type === 'offer-withdrawn') toast('La demande a été annulée', 'info', 2500);
    if (type === 'rider-cancelled') {
      toast(
        data?.compensation
          ? `Le passager a annulé — une indemnité de ${money(data.compensation)} a été ajoutée`
          : 'Le passager a annulé la course',
        'info',
        5000
      );
    }
    if (type === 'message' && data?.from === 'rider') setUnread((u) => u + 1);
  }, [toast]);

  const {
    loading, profile, online, position, offer, ride, busy, isConnected,
    goOnline, goOffline, accept, decline, arrive, start, complete, cancelTrip,
  } = useDriverState({ onEvent });

  // Offer countdown
  useEffect(() => {
    if (!offer) { setCountdown(0); return undefined; }
    const expires = offer.receivedAt + (offer.expiresInSeconds || 15) * 1000;
    const tick = () => setCountdown(Math.max(0, Math.ceil((expires - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [offer]);

  async function handleToggle() {
    try {
      if (online) await goOffline();
      else {
        await goOnline();
        toast('Vous êtes en ligne — vous recevrez des demandes', 'success');
      }
    } catch (err) {
      if (err.code === 'NO_VEHICLE') {
        toast('Ajoutez d’abord les informations de votre véhicule', 'error', 5000);
      } else {
        toast(err.message, 'error', 5000);
      }
    }
  }

  async function handleAccept() {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await accept();
      setUnread(0);
      toast('Course acceptée — rendez-vous au point de prise en charge', 'success');
    } catch (err) {
      toast(err.message, 'error', 4000);
    } finally {
      setActionBusy(false);
    }
  }

  async function run(fn, success) {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await fn();
      if (success) toast(success, 'success');
    } catch (err) {
      toast(err.message, 'error', 4000);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleStart() {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await start(pinValue);
      setPinOpen(false);
      setPinValue('');
      toast('Course démarrée', 'success');
    } catch (err) {
      toast(err.message, 'error', 4000);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleComplete() {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const finished = await complete();
      setReceipt(finished);
    } catch (err) {
      toast(err.message, 'error', 4000);
    } finally {
      setActionBusy(false);
    }
  }

  // Live navigation readout — distance/ETA from the driver's own GPS to
  // whichever leg they're on right now.
  const liveLeg = useMemo(() => {
    if (!ride || !position) return null;
    const target =
      ride.status === 'in_progress'
        ? { lat: ride.dropoff.lat, lng: ride.dropoff.lng }
        : { lat: ride.pickup.lat, lng: ride.pickup.lng };
    const meters = roadDistanceMeters(position, target);
    return {
      meters,
      minutes: etaFor(meters),
      label: ride.status === 'in_progress' ? 'jusqu’à destination' : 'jusqu’au point de prise en charge',
    };
  }, [ride, position]);

  const needsVehicle = profile && !profile.vehicle?.plate;
  const center = position || { lat: 40.7128, lng: -74.006 };

  return (
    <div className="ride-page">
      <div className="map-fill">
        <MapView
          center={center}
          zoom={14}
          userPosition={position || undefined}
          pickup={ride ? { lat: ride.pickup.lat, lng: ride.pickup.lng } : undefined}
          dropoff={ride && ride.status === 'in_progress' ? { lat: ride.dropoff.lat, lng: ride.dropoff.lng } : undefined}
          routeGeometry={ride?.status === 'in_progress' ? ride.route?.geometry : undefined}
          fit={Boolean(ride)}
        />
      </div>

      <div className="ride-panel">
        {/* ── Online toggle / status card ── */}
        {!ride && (
          <div className="card card-pad animate-in">
            {loading ? (
              <div className="skeleton" style={{ height: 52 }} />
            ) : needsVehicle ? (
              <>
                <h3 style={{ fontSize: '1.1rem' }}>Vous y êtes presque</h3>
                <p className="small muted mt-1 mb-4"> Ajoutez les informations de votre véhicule pour commencer à accepter des courses. </p>
                <Link href="/driver/profile" className="btn btn-primary btn-full">
                  <Car size={17} /> Ajouter mon véhicule </Link>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 style={{ fontSize: '1.1rem' }}>
                      {online ? 'Vous êtes en ligne' : 'Vous êtes hors ligne'}
                    </h3>
                    <p className="tiny muted mt-1">
                      {online
                        ? isConnected
                          ? 'En attente de demandes de course…'
                          : 'Reconnexion…'
                        : 'Passez en ligne pour recevoir des demandes'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggle}
                    disabled={busy}
                    aria-pressed={online}
                    aria-label={online ? 'Passer hors ligne' : 'Passer en ligne'}
                    className="btn-icon"
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: online ? 'var(--success)' : 'var(--ink-100)',
                      color: online ? '#fff' : 'var(--ink-500)',
                      boxShadow: online ? '0 4px 16px rgba(5,150,105,.35)' : 'none',
                      transition: 'background 250ms, box-shadow 250ms',
                      cursor: 'pointer',
                    }}
                  >
                    {busy ? <span className="spinner" /> : <Power size={24} />}
                  </button>
                </div>
                {online && (
                  <div className="flex items-center gap-2 mt-4 tiny muted">
                    <span className="badge badge-success badge-dot">En direct</span> Votre position se met à jour automatiquement lorsque vous êtes en ligne </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Active trip card ── */}
        {ride && (
          <div className="card card-pad animate-in">
            <div className="flex items-center justify-between mb-3">
              <span className={`badge badge-dot ${ride.status === 'in_progress' ? 'badge-info' : 'badge-gold'}`}>
                {ride.status === 'accepted' && 'Rejoignez le point de prise en charge'}
                {ride.status === 'arrived' && 'En attente du passager'}
                {ride.status === 'in_progress' && 'Course en cours'}
              </span>
              <span className="small mono-nums" style={{ fontWeight: 700 }}>
                {money(ride.fare?.driverEarnings)}
              </span>
            </div>

            {liveLeg && (
              <div
                className="flex items-center justify-between mb-3"
                style={{ background: 'var(--ink-50)', borderRadius: 12, padding: '10px 14px' }}
              >
                <span className="small" style={{ fontWeight: 700 }}>
                  {formatDistance(liveLeg.meters)} {liveLeg.label}
                </span>
                <span className="small mono-nums" style={{ fontWeight: 700, color: 'var(--gold-700)' }}>
                  ~{liveLeg.minutes} min
                </span>
              </div>
            )}

            <div className="flex-col gap-2 small mb-4">
              <div className="flex gap-2">
                <Circle size={14} style={{ marginTop: 4, color: 'var(--ink-950)', flexShrink: 0 }} />
                <span className="muted">{ride.pickup.address}</span>
              </div>
              <div className="flex gap-2">
                <MapPin size={14} style={{ marginTop: 4, color: 'var(--gold-600)', flexShrink: 0 }} />
                <span className="muted">{ride.dropoff.address}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="muted">Course</span>
                <span className="mono-nums">
                  {formatDistance(ride.route?.distanceMeters || 0)} ·{' '}
                  {formatDuration(ride.route?.durationSeconds || 0)}
                </span>
              </div>
            </div>

            {ride.status === 'accepted' && (
              <button className="btn btn-primary btn-lg btn-full" onClick={() => run(arrive, 'Le passager a été informé de votre arrivée')} disabled={actionBusy}>
                {actionBusy ? <span className="spinner" /> : <><Flag size={18} /> Je suis arrivé</>}
              </button>
            )}
            {ride.status === 'arrived' && (
              <button className="btn btn-primary btn-lg btn-full" onClick={() => setPinOpen(true)} disabled={actionBusy}>
                <KeyRound size={18} /> Saisir le code PIN pour démarrer </button>
            )}
            {ride.status === 'in_progress' && (
              <button className="btn btn-success btn-lg btn-full" onClick={handleComplete} disabled={actionBusy}>
                {actionBusy ? <span className="spinner" /> : <><CheckCircle2 size={18} /> Terminer la course</>}
              </button>
            )}

            <div className="flex gap-2 mt-3">
              <button className="btn btn-secondary flex-1" onClick={() => { setChatOpen(true); setUnread(0); }} style={{ position: 'relative' }}>
                <MessageCircle size={16} /> Discussion
                {unread > 0 && (
                  <span className="badge badge-danger" style={{ position: 'absolute', top: -6, right: -4, minWidth: 20, justifyContent: 'center', padding: '1px 6px' }}>
                    {unread}
                  </span>
                )}
              </button>
              {ride.status !== 'in_progress' && (
                <button className="btn btn-danger flex-1" onClick={() => setCancelOpen(true)}>
                  <X size={16} /> Annuler </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Incoming offer ── */}
      <Modal open={Boolean(offer)} onClose={() => {}} closable={false} title="">
        {offer && (
          <div className="text-center">
            <div
              className="mono-nums"
              style={{
                width: 64, height: 64, margin: '0 auto 12px', borderRadius: '50%',
                border: '3px solid var(--gold-600)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800,
                color: countdown <= 5 ? 'var(--danger)' : 'var(--text)',
              }}
              aria-live="polite"
            >
              {countdown}
            </div>
            <h3 style={{ fontSize: '1.2rem' }}>Nouvelle demande de course</h3>
            <p className="small muted mt-1 mb-4">
              {offer.rider?.name || 'Un passager'} · {formatDistance(offer.distanceToPickupMeters)} de distance · ~{offer.etaMinutes} min jusqu’à la prise en charge
            </p>

            <div className="card card-pad text-left mb-4" style={{ background: 'var(--ink-50)', border: 'none' }}>
              <div className="flex gap-2 small mb-2">
                <Circle size={13} style={{ marginTop: 4, flexShrink: 0 }} />
                <span className="truncate">{offer.pickup.address}</span>
              </div>
              <div className="flex gap-2 small">
                <MapPin size={13} style={{ marginTop: 4, color: 'var(--gold-600)', flexShrink: 0 }} />
                <span className="truncate">{offer.dropoff.address}</span>
              </div>
              <div className="flex items-center justify-between mt-3" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <span className="tiny muted">
                  {formatDistance(offer.distanceMeters)} · {formatDuration(offer.durationSeconds)}
                  {offer.surgeMultiplier > 1 && (
                    <span className="badge badge-warning" style={{ marginLeft: 8 }}>
                      <TrendingUp size={11} /> {offer.surgeMultiplier}×
                    </span>
                  )}
                </span>
                <span style={{ fontWeight: 800, fontSize: '1.15rem' }} className="mono-nums">
                  {money(offer.earnings)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="btn btn-secondary flex-1" onClick={decline} disabled={actionBusy}> Refuser </button>
              <button className="btn btn-success btn-lg flex-1" onClick={handleAccept} disabled={actionBusy || countdown === 0}>
                {actionBusy ? <span className="spinner" /> : 'Accepter'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── PIN entry ── */}
      <Modal open={pinOpen} onClose={() => setPinOpen(false)} title="Code PIN du passager">
        <p className="small muted mb-4">Demandez au passager son code PIN à 4 chiffres pour démarrer la course.</p>
        <input
          className="input text-center mono-nums"
          style={{ fontSize: '1.6rem', letterSpacing: '0.4em', fontWeight: 700 }}
          value={pinValue}
          onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          placeholder="0000"
          autoFocus
          aria-label="Code PIN du passager"
        />
        <button
          className="btn btn-primary btn-full mt-4"
          onClick={handleStart}
          disabled={pinValue.length !== 4 || actionBusy}
        >
          {actionBusy ? <span className="spinner" /> : <><Navigation size={17} /> Démarrer la course</>}
        </button>
      </Modal>

      {/* ── Cancel trip ── */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Annuler cette course ?">
        <p className="small muted mb-4"> Un autre chauffeur sera attribué au passager. Des annulations fréquentes réduisent votre priorité d’attribution. </p>
        <div className="flex-col gap-2">
          <button className="btn btn-danger btn-full" disabled={actionBusy} onClick={() => run(async () => { await cancelTrip('Le chauffeur a annulé'); setCancelOpen(false); }, 'Course annulée')}>
            {actionBusy ? <span className="spinner" /> : 'Oui, annuler la course'}
          </button>
          <button className="btn btn-ghost btn-full" onClick={() => setCancelOpen(false)}> Conserver la course </button>
        </div>
      </Modal>

      {/* ── Completion receipt ── */}
      <Modal open={Boolean(receipt)} onClose={() => setReceipt(null)} title="Course terminée 🎉">
        {receipt && (
          <div className="text-center">
            <div style={{ fontSize: '2.4rem', fontWeight: 800 }} className="mono-nums">
              {money(receipt.fare?.driverEarnings)}
            </div>
            <p className="small muted mt-1 mb-4"> gagnés sur cette course · versés sur votre portefeuille </p>
            <button className="btn btn-primary btn-full" onClick={() => setReceipt(null)}> Reprendre la conduite </button>
          </div>
        )}
      </Modal>

      {/* Chat */}
      {ride && (
        <ChatSheet
          rideId={ride.id}
          role="driver"
          messages={ride.messages || []}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          counterpartName="Passager"
        />
      )}
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/driver/dashboard')({head:()=>({meta:[{title:"Conduire · StrasDrive"},{name:'description',content:"StrasDrive — conduire, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Conduire · StrasDrive"},{property:'og:description',content:"StrasDrive — conduire, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <DriverLayout><DriverDashboard/></DriverLayout>});
