import { playSound } from '@/lib/sounds';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '@/context/SocketProvider';
import { watchRefresh } from '@/lib/live-refresh';

const PING_INTERVAL_MS = 3500;

/**
 * Owns the driver's live state: profile, online status, GPS streaming,
 * incoming offers, and the active trip.
 */
export default function useDriverState({ onEvent, enabled = true, userId } = {}) {
  const { socket, isConnected } = useSocket();
  const [profile, setProfile] = useState(null); // Driver doc
  const [online, setOnline] = useState(false);
  const [offer, setOffer] = useState(null); // incoming ride offer
  const [ride, setRide] = useState(null); // active serialized ride
  const [position, setPosition] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const watchIdRef = useRef(null);
  const lastPingRef = useRef(0);
  const rideRef = useRef(null);
  const socketRef = useRef(null);
  const onEventRef = useRef(onEvent);
  const availabilityAction = useRef(false);
  const availabilityRevision = useRef(0);
  useEffect(() => {
    rideRef.current = ride;
    socketRef.current = socket;
    onEventRef.current = onEvent;
  });

  const notify = useCallback((type, data) => onEventRef.current?.(type, data), []);

  // ── Initial load: profile + active ride ──
  useEffect(() => {
    if (!enabled) {
      setProfile(null); setOffer(null); setRide(null); setOnline(false); setPosition(null); setLoading(true);
      return;
    }
    setLoading(true);
    setProfile(null); setOffer(null); setRide(null); setOnline(false);
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
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled) return;
    return watchRefresh(async (active, signal) => {
      if (availabilityAction.current) return;
      const revision = availabilityRevision.current;
      try {
        const res = await fetch('/api/drivers/me', { signal });
        if (!res.ok) return;
        const { driver } = await res.json();
        if (active() && revision === availabilityRevision.current) {
          setProfile(driver);
          setOnline(Boolean(driver.isOnline));
          if (driver.isReportSuspended) setOffer(null);
        }
      } catch { /* retain last known status while offline */ }
    }, 5000);
  }, [enabled, userId]);

  // ── GPS watch + socket ping while online (or on a trip) ──
  useEffect(() => {
    const shouldTrack = enabled && (online || Boolean(ride));
    if (!shouldTrack || !navigator.geolocation) return undefined;

    let stopped = false;
    let checking = false;
    const options = { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 };
    const sendFix = (pos) => {
      if (stopped) return;
      const point = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
      };
      setPosition(point);
      const now = Date.now();
      if (now - lastPingRef.current >= PING_INTERVAL_MS && socketRef.current) {
        lastPingRef.current = now;
        socketRef.current.emit('driver:location', { ...point, rideId: rideRef.current?.id });
      }
    };
    watchIdRef.current = navigator.geolocation.watchPosition(sendFix, () => {}, options);
    // Stationary drivers may receive no new watch event. Request a fresh fix,
    // rather than keeping an old position alive while GPS is unavailable.
    const heartbeat = online && typeof navigator.geolocation.getCurrentPosition === 'function'
      ? setInterval(() => {
          if (checking || document.hidden || Date.now() - lastPingRef.current < 12000) return;
          checking = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => { checking = false; sendFix(pos); },
            () => { checking = false; },
            options,
          );
        }, 12000)
      : null;

    return () => {
      stopped = true;
      clearInterval(heartbeat);
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, online, Boolean(ride)]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket events ──
  useEffect(() => {
    if (!enabled || !socket) return undefined;

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
  }, [enabled, socket, isConnected, notify]);

  // ── Actions ──
  const getFix = () =>
    new Promise((resolve, reject) => {
      // Browsers only allow geolocation on https:// or localhost. Opening the
      // app via an IP like 0.0.0.0 silently blocks it with no prompt.
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        return reject(
          new Error(
            `La géolocalisation est bloquée sur ${window.location.hostname} — ouvrez l’application sur http://localhost:${window.location.port || 3000} (ou via https) pour passer en ligne`
          )
        );
      }
      if (!navigator.geolocation) return reject(new Error('Géolocalisation non prise en charge'));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) =>
          reject(
            new Error(
              err.code === 1
                ? 'Autorisation de géolocalisation refusée — autorisez la localisation pour ce site dans les paramètres de votre navigateur, puis réessayez'
                : 'Impossible d’obtenir votre position — réessayez'
            )
          ),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });

  const goOnline = useCallback(async () => {
    if (availabilityAction.current) return;
    availabilityAction.current = true;
    ++availabilityRevision.current;
    setBusy(true);
    try {
      const location = await getFix();
      const res = await fetch('/api/drivers/me/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: true, location }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Impossible de passer en ligne');
        err.code = data.code;
        throw err;
      }
      setPosition(location);
      setOnline(true);
      try { playSound('driver-online'); } catch { /* audio must not affect availability */ }
      // Announce immediately so the H3 index has a fresh ping
      socketRef.current?.emit('driver:location', { ...location });
    } finally {
      availabilityAction.current = false;
      ++availabilityRevision.current;
      setBusy(false);
    }
  }, []);

  const goOffline = useCallback(async () => {
    if (availabilityAction.current) return;
    availabilityAction.current = true;
    ++availabilityRevision.current;
    setBusy(true);
    try {
      const res = await fetch('/api/drivers/me/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossible de passer hors ligne');
      socketRef.current?.emit('driver:offline');
      setOnline(false);
      try { playSound('driver-offline'); } catch { /* audio must not affect availability */ }
    } finally {
      availabilityAction.current = false;
      ++availabilityRevision.current;
      setBusy(false);
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
    return data.ride;
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
    const rideId = rideRef.current.id;
    const data = await act(rideId, 'arrive');
    setRide((current) => current?.id === rideId ? data.ride : current);
  }, [act]);

  const start = useCallback(async (pin) => {
    const rideId = rideRef.current.id;
    const data = await act(rideId, 'start', { pin });
    setRide((current) => current?.id === rideId ? data.ride : current);
  }, [act]);

  const complete = useCallback(async () => {
    const data = await act(rideRef.current.id, 'complete');
    setRide(null);
    return data.ride;
  }, [act]);

  const cancelTrip = useCallback(async (reason) => {
    await act(rideRef.current.id, reason === 'rider_no_show' ? 'cancel_no_show' : 'cancel', { reason });
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
