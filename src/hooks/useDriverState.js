import {apiFetch as fetch} from '@/lib/archive-fetch';
import {getDriverLocation, withDeadline} from '@/lib/driver-connection';
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '@/context/SocketProvider';

const PING_INTERVAL_MS = 3500;

/**
 * Owns the driver's live state: profile, online status, GPS streaming,
 * incoming offers, and the active trip.
 */
export default function useDriverState({ onEvent } = {}) {
  const { socket, isConnected } = useSocket();
  const [profile, setProfile] = useState(null); // Driver doc
  const [online, setOnline] = useState(false);
  const [offer, setOffer] = useState(null); // incoming ride offer
  const [ride, setRide] = useState(null); // active serialized ride
  const [position, setPosition] = useState(null);
  const [busy, setBusy] = useState(false);
  const [connectionStage, setConnectionStage] = useState('');
  const [loading, setLoading] = useState(true);

  const watchIdRef = useRef(null);
  const lastPingRef = useRef(0);
  const rideRef = useRef(null);
  const socketRef = useRef(null);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    rideRef.current = ride;
    socketRef.current = socket;
    onEventRef.current = onEvent;
  });

  const notify = useCallback((type, data) => onEventRef.current?.(type, data), []);

  // ── Initial load: profile + active ride ──
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [profileRes, activeRes] = await Promise.all([
          fetch('/api/drivers/me'),
          fetch('/api/rides/active?view=driver'),
        ]);
        if (profileRes.ok) {
          const { driver } = await profileRes.json();
          if (!ignore) {
            setProfile(driver);
            setOnline(Boolean(driver.isOnline));
          }
        }
        if (activeRes.ok) {
          const { ride: active } = await activeRes.json();
          if (!ignore && active) setRide(active);
        }
      } catch { /* offline — retry on action */ }
      finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      try {
        const res = await fetch('/api/drivers/me');
        if (!res.ok) return;
        const { driver } = await res.json();
        if (!stopped) {
          setProfile(driver);
          setOnline(Boolean(driver.isOnline));
          if (driver.isReportSuspended) setOffer(null);
        }
      } catch { /* retain last known status while offline */ }
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);

  // ── GPS watch + socket ping while online (or on a trip) ──
  useEffect(() => {
    const shouldTrack = online || Boolean(ride);
    if (!shouldTrack || !navigator.geolocation) return undefined;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        };
        setPosition(point);

        const now = Date.now();
        if (now - lastPingRef.current >= PING_INTERVAL_MS) {
          lastPingRef.current = now;
          socketRef.current?.emit('driver:location', {
            ...point,
            rideId: rideRef.current?.id,
          });
        }
      },
      () => { /* watch errors are non-fatal; next fix retries */ },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [online, Boolean(ride)]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket events ──
  useEffect(() => {
    if (!socket) return undefined;

    const subscribe = () => {
      const current = rideRef.current;
      if (current?.id) socket.emit('ride:subscribe', { rideId: current.id });
    };
    socket.on('connect', subscribe);
    if (isConnected) subscribe();

    const handlers = {
      'ride:offer': (data) => {
        // Ignore offers while already on a trip (stale cascade edge)
        if (rideRef.current) return;
        setOffer({ ...data, receivedAt: Date.now() });
        notify('offer', data);
      },
      'ride:offer-updated': (data) => {
        // Enrich the current offer without restarting the countdown or ringing.
        setOffer((current) => current?.rideId === data.rideId ? { ...current, airportReturn: data.airportReturn } : current);
        notify('offer-updated', data);
      },
      'ride:offer-expired': (data) => {
        setOffer((o) => (o && o.rideId === data.rideId ? null : o));
        notify('offer-expired', data);
      },
      'ride:offer-withdrawn': (data) => {
        setOffer((o) => (o && o.rideId === data.rideId ? null : o));
        notify('offer-withdrawn', data);
      },
      'ride:cancelled': (data) => {
        if (rideRef.current?.id === data.rideId) {
          setRide(null);
          notify('rider-cancelled', data);
        }
      },
      'ride:message': (data) => {
        setRide((r) => {
          if (!r || r.id !== data.rideId) return r;
          return { ...r, messages: [...(r.messages || []), { ...data, rideId: undefined }] };
        });
        notify('message', data);
      },
    };

    for (const [event, fn] of Object.entries(handlers)) socket.on(event, fn);
    return () => {
      socket.off('connect', subscribe);
      for (const [event, fn] of Object.entries(handlers)) socket.off(event, fn);
    };
  }, [socket, isConnected, notify]);

  // ── Actions ──
  const goOnline = useCallback(async () => {
    setBusy(true);
    try {
      setConnectionStage('Localisation…');
      const location = await getDriverLocation();
      setConnectionStage('Connexion…');
      const res = await withDeadline(fetch('/api/drivers/me/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: true, location }),
      }), 20000, 'Le serveur ne répond pas. Votre statut sera revérifié automatiquement ; vérifiez votre connexion.');
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Impossible de passer en ligne');
        err.code = data.code;
        throw err;
      }
      setPosition(location);
      setOnline(true);
      // Announce immediately so the H3 index has a fresh ping
      socketRef.current?.emit('driver:location', { ...location });
    } finally {
      setBusy(false);
      setConnectionStage('');
    }
  }, []);

  const goOffline = useCallback(async () => {
    setBusy(true);
    try {
      const res = await withDeadline(fetch('/api/drivers/me/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: false }),
      }), 20000, 'Le serveur ne répond pas. Votre statut sera revérifié automatiquement ; vérifiez votre connexion.');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossible de passer hors ligne');
      socketRef.current?.emit('driver:offline');
      setOnline(false);
    } finally {
      setBusy(false);
      setConnectionStage('');
    }
  }, []);

  const act = useCallback(async (rideId, action, body) => {
    const res = await fetch(`/api/rides/${rideId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ({
      accept: 'Impossible d’accepter la course',
      decline: 'Impossible de refuser la demande',
      arrive: 'Impossible de signaler votre arrivée',
      start: 'Impossible de démarrer la course',
      complete: 'Impossible de terminer la course',
      cancel: 'Impossible d’annuler la course',
    }[action] || 'Impossible d’effectuer cette action'));
    return data;
  }, []);

  const accept = useCallback(async () => {
    if (!offer) return;
    const data = await act(offer.rideId, 'accept');
    setOffer(null);
    setRide(data.ride);
    socketRef.current?.emit('ride:subscribe', { rideId: data.ride.id });
  }, [offer, act]);

  const decline = useCallback(async () => {
    if (!offer) return;
    const { rideId } = offer;
    setOffer(null);
    try {
      await act(rideId, 'decline');
    } catch { /* timeout already advanced the cascade */ }
  }, [offer, act]);

  const arrive = useCallback(async () => {
    const data = await act(rideRef.current.id, 'arrive');
    setRide((r) => ({ ...r, status: data.ride.status }));
  }, [act]);

  const start = useCallback(async (pin) => {
    const data = await act(rideRef.current.id, 'start', { pin });
    setRide((r) => ({ ...r, status: data.ride.status }));
  }, [act]);

  const complete = useCallback(async () => {
    const data = await act(rideRef.current.id, 'complete');
    setRide(null);
    return data.ride;
  }, [act]);

  const cancelTrip = useCallback(async (reason) => {
    await act(rideRef.current.id, 'cancel', { reason });
    setRide(null);
  }, [act]);

  return {
    loading,
    profile,
    setProfile,
    online,
    position,
    offer,
    ride,
    busy,
    connectionStage,
    isConnected,
    goOnline,
    goOffline,
    accept,
    decline,
    arrive,
    start,
    complete,
    cancelTrip,
  };
}
