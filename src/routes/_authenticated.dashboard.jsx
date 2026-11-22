import CloseControl from "@/components/ui/CloseControl";
import ReportDriverButton from "@/components/ride/ReportDriverButton";
import RideSafety from '@/components/ride/RideSafety';
import { createFileRoute } from "@tanstack/react-router";
import RiderLayout from "@/components/RiderLayout";
import { apiFetch as fetch } from "@/lib/archive-fetch";
("use client");

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Navigation,
  Clock,
  UserRound,
  MapPin,
  Circle,
  Car,
  PawPrint,
  Users,
  Zap,
  Wallet,
  Banknote,
  CreditCard,
  MessageCircle,
  X,
  ShieldCheck,
  Copy,
  TrendingUp,
  LocateFixed,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "@/lib/archive-navigation";
import MapView from "@/components/ArchiveMap";
import PlaceSearch from "@/components/maps/PlaceSearch";
import ChatSheet from "@/components/ride/ChatSheet";
import MessageAlert from "@/components/ride/MessageAlert";
import { whenChatMessageReady } from "@/lib/chat-media-cache";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Avatar, Stars, StarPicker, VEHICLE_LABELS, money } from "@/components/ui/bits";
import useRiderRide from "@/hooks/useRiderRide";
import { bookingPaymentProblem, paymentMethodLabel } from "@/lib/vtc-pricing";
import FavoriteQuoteRow from "@/components/private-clients/FavoriteQuoteRow";
import FavoriteRideChoice from "@/components/private-clients/FavoriteRideChoice";
import { readPendingClaim } from "@/lib/private-client-claim";
import { playSound } from "@/lib/sounds";
import useVisualViewport from "@/hooks/useVisualViewport";
import useGeolocation from "@/hooks/useGeolocation";
import { useLiveRoute } from "@/hooks/useLiveRoute";
import { riderTripActivity } from "@/lib/live-activity";
import { syncLiveActivity, stopLiveActivity } from "@/lib/live-activity-native";
import { routeQualityLabel } from "@/lib/vtc-routing";
import { readRideDraft, clearRideDraft } from "@/lib/ride-draft";
import { drawableRoute, arrivalClock } from "@/lib/utils/route-display";
import {
  formatDistance,
  formatDuration,
  roadDistanceMeters,
  haversineDistance,
  etaMinutes as etaFor,
} from "@/lib/utils/geo";
const VEHICLE_META = {
  economy: { icon: Car, blurb: "Des courses au quotidien à prix avantageux" },
  comfort: { icon: Car, blurb: "Voitures récentes, plus d’espace pour les jambes" },
  pet: { icon: PawPrint, blurb: "Voyagez sereinement avec votre animal de compagnie" },
  xl: { icon: Users, blurb: "Jusqu’à 8 passagers" },
};
const CANCEL_REASONS = [
  "Le chauffeur met trop de temps",
  "Réservation faite par erreur",
  "Mes plans ont changé",
  "J’ai trouvé un autre moyen de transport",
];

function RiderDashboard() {
  const toast = useToast();
  const bookingPanelRef = useRef(null);
  const { position: gpsPosition } = useGeolocation({ watch: false });
  const [locatedPosition, setGeo] = useState(null);
  const geo = locatedPosition || gpsPosition;
  const locationRequestRef = useRef(0);

  // Booking form state
  const [pickup, setPickup] = useState(null); // {address, lat, lng}
  const [dropoff, setDropoff] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("card"); // 'card' | 'cash'
  const [pickupText, setPickupText] = useState("");
  const [dropoffText, setDropoffText] = useState("");
  const [estimate, setEstimate] = useState(null); // {route, estimates}
  const [estimating, setEstimating] = useState(false);
  const [vehicleType, setVehicleType] = useState("economy");
  // True only when the rider explicitly picks her favorite driver; any other row means ordinary dispatch.
  const [favoriteSelected, setFavoriteSelected] = useState(false);
  const [allowGoldReplacement, setAllowGoldReplacement] = useState(false);
  const [pendingClaim, setPendingClaim] = useState(null);
  useEffect(() => {
    setPendingClaim(readPendingClaim());
  }, []);
  const [walletBalance, setWalletBalance] = useState(null);
  const [booking, setBooking] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [availability, setAvailability] = useState(null); // {economy:{count,etaMinutes},…}
  const [chatOpen, setChatOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [unread, setUnread] = useState(0);
  const [lastMsg, setLastMsg] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const blurTimerRef = useRef(null);
  const onSearchFocus = useCallback((focused) => {
    clearTimeout(blurTimerRef.current);
    if (focused) setSearchFocused(true);
    else blurTimerRef.current = setTimeout(() => setSearchFocused(false), 150);
  }, []);
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const vv = useVisualViewport(isPhone);
  useEffect(() => () => { locationRequestRef.current += 1; clearTimeout(blurTimerRef.current); }, []);
  const keyboardOpen = Boolean(vv && window.innerHeight - vv.height > 150);
  const chatOpenRef = useRef(false);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  const onRideEvent = useCallback(
    (type, data) => {
      const sound = {
        accepted: "driver-found",
        arrived: "arrived",
        started: "started",
        "driver-cancelled": "cancelled",
        "no-drivers": "cancelled",
        completed: "completed",
      }[type];
      if (sound) playSound(sound);
      if (type === "accepted") toast("Chauffeur trouvé — il est en route !", "success");
      if (type === "arrived") toast("Votre chauffeur est arrivé", "success", 5000);
      if (type === "started") toast("Course démarrée — bon trajet", "info");
      if (type === "no-drivers")
        toast("Aucun chauffeur disponible pour le moment. Veuillez réessayer dans quelques instants.", "error", 5000);
      if (type === "driver-cancelled") toast("Le chauffeur a annulé — nous vous en cherchons un autre…", "info", 5000);
      if (type === "completed" && data?.shortfall) {
        toast(
          "Votre portefeuille est devenu débiteur — rechargez-le pour réserver votre prochaine course",
          "info",
          8000,
        );
      }
      if (type === "message" && data?.from === "driver") {
        whenChatMessageReady(data.rideId, data).then(() => {
          playSound("message");
          if (chatOpenRef.current) return;
          setUnread((u) => u + 1);
          setLastMsg(data);
          if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        });
      }
    },
    [toast],
  );

  const {
    phase,
    ride,
    driverPosition,
    etaMinutes,
    offersSent,
    completedRide,
    clearCompleted,
    loadingActive,
    book,
    adoptRide,
    cancel,
    rate,
  } = useRiderRide({ onEvent: onRideEvent });

  const draftRestored = useRef(false);
  useEffect(() => {
    if (loadingActive || draftRestored.current) return;
    draftRestored.current = true;
    if (phase !== 'idle') return;
    const draft = readRideDraft();
    if (!draft) return;
    setPickup(draft.pickup);
    setDropoff(draft.dropoff);
    setPickupText(draft.pickupText);
    setDropoffText(draft.dropoffText);
    clearRideDraft();
  }, [loadingActive, phase]);

  // ── Wallet balance ──
  const refreshWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/users/me");
      if (res.ok) {
        const { user } = await res.json();
        setWalletBalance(user.wallet?.balance ?? 0);
      }
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  // Pickup location is requested only by the explicit location button.
  const [locating, setLocating] = useState(false);
  function handleLocateMe() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast("La localisation n’est pas disponible sur cet appareil", "error");
      return;
    }
    const requestId = ++locationRequestRef.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (requestId !== locationRequestRef.current) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address = "Position actuelle";
        try {
          const res = await fetch(`/api/geo/search?reverse=1&lat=${lat}&lng=${lng}`);
          const data = await res.json();
          address = data.results?.[0]?.address || address;
        } catch {
          /* adresse générique */
        }
        if (requestId !== locationRequestRef.current) return;
        setGeo({ lat, lng });
        setPickup({ address, lat, lng });
        setPickupText(address);
        setLocating(false);
      },
      () => {
        if (requestId !== locationRequestRef.current) return;
        setLocating(false);
        toast("Impossible d’obtenir votre position — autorisez la localisation", "error", 5000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  // ── Nearby drivers (idle only, 10s poll) ──
  useEffect(() => {
    if (phase !== "idle" || !pickup) {
      setNearby([]);
      setAvailability(null);
      return undefined;
    }
    let timer;
    let stopped = false;
    async function load() {
      try {
        const res = await fetch(`/api/drivers/nearby?lat=${pickup.lat}&lng=${pickup.lng}`);
        if (res.ok) {
          const data = await res.json();
          if (!stopped) {
            setNearby(data.drivers || []);
            setAvailability(data.availability || null);
          }
        }
      } catch {
        /* ignore */
      }
      timer = setTimeout(load, 10000);
    }
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [phase, pickup?.lat, pickup?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fare estimate when both points set ──
  useEffect(() => {
    if (!pickup || !dropoff) {
      setEstimate(null);
      return undefined;
    }
    let ignore = false;
    setEstimating(true);
    (async () => {
      try {
        const res = await fetch("/api/rides/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickup: { lat: pickup.lat, lng: pickup.lng },
            dropoff: { lat: dropoff.lat, lng: dropoff.lng },
          }),
        });
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data?.estimates) {
          setEstimate(data);
          if (data.favorite?.status !== "available" || !data.favorite?.fare) setFavoriteSelected(false);
        }
        else {
          setEstimate(null);
          toast(data?.error || "Impossible d’estimer le tarif — réessayez dans un instant", "error");
        }
      } catch {
        if (!ignore) toast("Impossible d’estimer le tarif — vérifiez votre connexion", "error");
      } finally {
        if (!ignore) setEstimating(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Book ──
  async function handleBook() {
    if (!pickup || !dropoff || booking) return;
    const bookedType = favoriteSelected && estimate?.favorite ? estimate.favorite.vehicleType : vehicleType;
    setBooking(true);
    try {
      await book({ pickup, dropoff, vehicleType: bookedType, paymentMethod, favorite: favoriteSelected, allowGoldReplacement });
      setUnread(0);
      setLastMsg(null);
      toast("Recherche d’un chauffeur en cours…", "success");
    } catch (err) {
      toast(err.message, "error", 5000);
    } finally {
      setBooking(false);
    }
  }

  async function handleCancel(reason) {
    setCancelling(true);
    try {
      await cancel(reason);
      setCancelOpen(false);
      toast("Course annulée", "info");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setCancelling(false);
    }
  }

  const saveFavorite = useCallback(async (driverId, { confirmReplacement, expectedDriverId }) => {
    const res = await fetch("/api/riders/me/favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, confirmReplacement, expectedDriverId }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Impossible de modifier votre chauffeur favori.");
    return data;
  }, []);

  async function handleRate() {
    if (!completedRide || !rating || submittingRating) return;
    setSubmittingRating(true);
    try {
      await rate(completedRide.id, rating, ratingComment);
      toast("Merci pour votre avis !", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSubmittingRating(false);
      clearCompleted();
      setRating(0);
      setRatingComment("");
      refreshWallet();
    }
  }

  // Live distance + ETA: traffic-aware route from the server (Google Routes, shared with the driver),
  // with a rough estimate from the driver's GPS until the first answer arrives.
  const liveRoute = useLiveRoute(phase === "active" ? ride?.id : null, ride?.status);
  useEffect(() => {
    if (loadingActive) return;
    const activity = riderTripActivity(ride, liveRoute);
    if (activity) void syncLiveActivity(activity);
    else void stopLiveActivity('rider_trip');
  }, [loadingActive, ride?.id, ride?.status, liveRoute?.status, liveRoute?.durationSeconds]);
  const liveTrip = useMemo(() => {
    if (phase !== "active" || !ride || (ride.status !== "accepted" && ride.status !== "in_progress")) return null;
    const toDestination = ride.status === "in_progress";
    if (liveRoute) {
      return {
        meters: liveRoute.distanceMeters,
        minutes: Math.max(1, Math.round(liveRoute.durationSeconds / 60)),
        seconds: liveRoute.durationSeconds,
        toDestination,
        quality: routeQualityLabel(liveRoute),
        approximate: liveRoute.approximate,
      };
    }
    if (!driverPosition) return null;
    const target = toDestination ? ride.dropoff : ride.pickup;
    const meters = roadDistanceMeters(driverPosition, { lat: target.lat, lng: target.lng });
    return {
      meters,
      minutes: etaFor(meters),
      seconds: etaFor(meters) * 60,
      toDestination,
      quality: "Calcul de l’itinéraire…",
      approximate: true,
    };
  }, [phase, ride, driverPosition, liveRoute]);

  const favoriteChosen = favoriteSelected && estimate?.favorite?.status === "available" && estimate.favorite.fare;
  const selectedFare = favoriteChosen ? estimate.favorite.fare : estimate?.estimates?.[vehicleType];
  const surge = selectedFare?.surgeMultiplier > 1;
  const selectedAvailability = availability?.[vehicleType];
  const noDriverForSelected = !favoriteChosen && selectedAvailability != null && selectedAvailability.count === 0;
  const payProblem =
    walletBalance != null && selectedFare
      ? bookingPaymentProblem(paymentMethod, walletBalance, selectedFare.total)
      : null;
  const insufficientWallet = Boolean(payProblem);

  const mapProps = useMemo(() => {
    if (phase === "active" && ride) {
      const beforePickup = ride.status !== "in_progress";
      const p = { lat: ride.pickup.lat, lng: ride.pickup.lng };
      return {
        pickup: p,
        dropoff: { lat: ride.dropoff.lat, lng: ride.dropoff.lng },
        routeGeometry:
          drawableRoute(liveRoute?.geometry) ||
          (ride.status === "in_progress" ? drawableRoute(ride.route?.geometry) : undefined),
        driverPosition,
        userPosition: geo || undefined,
        fit: true,
        // Before pickup, zoom on the driver coming to the rider
        fitTo: beforePickup && driverPosition ? [p, driverPosition] : undefined,
        fitKey: `${ride.status}|${driverPosition ? "d" : "-"}`,
      };
    }
    // Once an address is set, frame the nearby available drivers around it
    const close = pickup
      ? nearby
          .filter((d) => d.location && haversineDistance(pickup.lat, pickup.lng, d.location.lat, d.location.lng) <= 15)
          .map((d) => d.location)
      : [];
    return {
      pickup: pickup ? { lat: pickup.lat, lng: pickup.lng } : undefined,
      dropoff: dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : undefined,
      routeGeometry: drawableRoute(estimate?.route?.geometry),
      drivers: nearby,
      userPosition: geo || undefined,
      followPosition: !pickup && geo ? geo : undefined,
      fit: Boolean(pickup),
      fitTo: pickup
        ? [
            pickup,
            dropoff,
            ...close,
            ...(dropoff && drawableRoute(estimate?.route?.geometry)
              ? estimate.route.geometry.map(([lng, lat]) => ({ lat, lng }))
              : []),
          ].filter(Boolean)
        : undefined,
      fitKey: `${pickup?.lat},${pickup?.lng}|${dropoff?.lat},${dropoff?.lng}|${estimate ? "r" : "-"}|${nearby
        .map((d) => d.id)
        .sort()
        .join(",")}`,
    };
  }, [phase, ride, driverPosition, pickup, dropoff, estimate, nearby, geo, liveRoute]);

  const center = geo || { lat: 48.5734, lng: 7.7521 };

  return (
    <div className={`ride-page rider-workspace ${phase === "active" ? "rider-active-trip" : ""}`}>
      <div className="map-fill">
        <MapView center={center} zoom={13} {...mapProps} />
      </div>

      <div
        className={`ride-panel rider-trip-panel ${searchFocused ? "is-editing" : ""} ${phase === "idle" && estimate && !estimating ? "has-estimate" : ""}`}
        ref={bookingPanelRef}
        style={
          phase === "active" && vv ? {
            "--rider-visible-height": `${vv.height}px`,
            "--rider-visible-top": `${vv.top}px`,
          } : vv ? {
            position: "fixed",
            top: "auto",
            bottom: keyboardOpen
              ? Math.max(0, window.innerHeight - vv.top - vv.height) + 12
              : "calc(86px + env(safe-area-inset-bottom))",
            maxHeight: Math.max(120, vv.height - (keyboardOpen ? 24 : 106)),
            zIndex: 45,
          } : undefined
        }
      >
        {/* ── IDLE: booking form ── */}
        {phase === "idle" && !loadingActive && (
          <div className="card card-pad animate-in rider-booking-card">
            {pendingClaim && (
              <Link href="/join" className="booking-notice tiny mb-3" style={{ display: "block", fontWeight: 600 }}>
                Invitation de {pendingClaim.driver?.name || "votre chauffeur"} en attente — touchez pour l’ajouter en
                favori
              </Link>
            )}
            <div className="rider-booking-heading">
            <h2 style={{ fontSize: "1.25rem", marginBottom: 0 }}>
              <span className="rider-mobile-heading">Où allez-vous ?</span>
              <span className="rider-desktop-heading">Votre prochain trajet</span>
            </h2>
            {estimate && (
              <CloseControl
                className="rider-close-estimate"
                label="Fermer les tarifs"
                title="Fermer les tarifs"
                disabled={booking}
                onClick={() => {
                  clearTimeout(blurTimerRef.current);
                  document.activeElement?.blur?.();
                  setSearchFocused(false);
                  setDropoff(null);
                  setDropoffText("");
                  setEstimate(null);
                  setEstimating(false);
                }}
              />
            )}
            </div>

            <p className="rider-desktop-intro">Indiquez votre départ et votre destination pour découvrir votre trajet.</p>


            {estimate && !searchFocused ? (
              <div className="rider-route-summary-compact" aria-label="Itinéraire sélectionné">
                <div className="rider-route-summary-addresses">
                  <span className="rider-route-summary-pickup" title={pickupText}>{pickupText || "Départ"}</span>
                  <span className="rider-route-summary-dropoff" title={dropoffText}>➜ {dropoffText || "Destination"}</span>
                </div>
                <button type="button" className="rider-route-summary-edit" onClick={() => {
                  setEstimate(null);
                  setEstimating(false);
                  setFavoriteSelected(false);
                }}>Modifier</button>
              </div>
            ) : (
              <>
            <div className="flex-col gap-3">
              <div className="rider-pickup-row">
              <div className="rider-pickup-field">
              <PlaceSearch
                value={pickupText}
                onChangeText={(t) => {
                  locationRequestRef.current += 1;
                  setLocating(false);
                  setPickupText(t);
                  if (pickup) setPickup(null);
                }}
                onSelect={(r) => {
                  locationRequestRef.current += 1;
                  setLocating(false);
                  setPickup(r);
                  setPickupText(r.address);
                  // Focus destination uniquement après un choix explicite du départ
                  // (jamais au remontage de l'onglet, sinon le champ remonte en haut).
                  const inputs = bookingPanelRef.current?.querySelectorAll("input");
                  inputs?.[1]?.focus();
                }}
                committedValue={pickup?.address}
                placeholder="Lieu de prise en charge"
                onFocusChange={onSearchFocus}
                icon={Circle}
                bias={geo || undefined}
              />
              </div>
              <button
                type="button"
                className="rider-locate-btn"
                onClick={handleLocateMe}
                disabled={locating}
                aria-label="Me localiser"
                title="Utiliser ma position actuelle"
              >
                {locating ? <Loader2 size={18} className="spin" /> : <LocateFixed size={18} />}
              </button>
              </div>
              <PlaceSearch
                value={dropoffText}
                onChangeText={(t) => {
                  setDropoffText(t);
                  if (dropoff) setDropoff(null);
                }}
                onSelect={(r) => {
                  setDropoff(r);
                  setDropoffText(r.address);
                }}
                committedValue={dropoff?.address}
                placeholder="Quelle est votre destination ?"
                onFocusChange={onSearchFocus}
                icon={MapPin}
                bias={geo || undefined}
              />
            </div>
              <div className="rider-booking-context">
                <div className="rider-pickup-time"><Clock size={18} /><span>Prise en charge immédiate</span></div>
                <div className="rider-passenger"><UserRound size={15} /> Pour moi</div>
                {!estimate && (
                  <button className="btn rider-search-button" onClick={() => {
                    const inputs = bookingPanelRef.current?.querySelectorAll("input");
                    inputs?.[pickup ? 1 : 0]?.focus();
                  }}>{estimating ? "Recherche…" : "Rechercher"}</button>
                )}
              </div>
              </>
            )}
            {estimating && (
              <div className="flex items-center gap-2 mt-4 muted small">
                <span className="spinner" /> Calcul des tarifs…{" "}
              </div>
            )}

            {estimate && !estimating && !searchFocused && (
              <>
                <div className="flex items-center justify-between mt-4 mb-2">
                  <span className="tiny" style={{ minWidth: 0 }}>
                    <span className="muted" style={{ display: "block" }}>
                      {formatDistance(estimate.route.distanceMeters)} · {estimate.route.approximate ? "~" : ""}
                      {formatDuration(estimate.route.durationSeconds)} de trajet · arrivée vers{" "}
                      {arrivalClock(estimate.route.durationSeconds)}
                    </span>
                    <span
                      style={{
                        display: "block",
                        color: estimate.route.approximate ? "var(--warning)" : "var(--text-2)",
                      }}
                    >
                      {routeQualityLabel(estimate.route)}
                    </span>
                  </span>
                  {surge && (
                    <span className="badge badge-warning">
                      <TrendingUp size={12} /> {selectedFare.surgeMultiplier}× demande
                    </span>
                  )}
                </div>

                <div className="flex-col gap-2">
                  <FavoriteQuoteRow
                    favorite={estimate.favorite}
                    selected={Boolean(favoriteChosen)}
                    onSelect={() => setFavoriteSelected(true)}
                  />
                  {favoriteChosen && <label className="flex items-center gap-2 text-sm" style={{ padding: "8px 2px" }}>
                    <input type="checkbox" checked={allowGoldReplacement} onChange={(e) => setAllowGoldReplacement(e.target.checked)} />
                    Si mon favori est indisponible, je consens à un chauffeur remplaçant Gold (même prix affiché).
                  </label>}
                  {(() => {
                    const types = ["economy", "comfort", "pet", "xl"].filter((type) => estimate.estimates[type]);
                    const index = Math.max(0, types.indexOf(vehicleType));
                    const type = types[index];
                    if (!type) return null;
                    const fare = estimate.estimates[type];
                    const Meta = VEHICLE_META[type];
                    const avail = availability?.[type];
                    const changeType = (nextIndex) => {
                      setFavoriteSelected(false);
                      setVehicleType(types[nextIndex]);
                    };
                    return (
                      <div className="rider-vehicle-carousel" aria-label="Choisir une catégorie de course">
                        <button type="button" className="rider-vehicle-arrow" aria-label="Catégorie précédente"
                          disabled={index === 0} onClick={() => changeType(index - 1)}>
                          <ChevronLeft size={22} />
                        </button>
                        <div className="vehicle-row selected rider-vehicle-carousel-card" aria-live="polite">
                          <Meta.icon size={25} style={{ color: "var(--gold-600)", flexShrink: 0 }} />
                          <span className="flex-1" style={{ minWidth: 0 }}>
                            <span className="small" style={{ display: "block", fontWeight: 700 }}>{VEHICLE_LABELS[type]}</span>
                            <span className="tiny muted" style={{ display: "block" }}>{Meta.blurb}</span>
                            {avail && (
                              <span className="tiny vehicle-availability" style={{
                                display: "block", fontWeight: 600,
                                color: avail.count ? "var(--success)" : "var(--text-2)",
                              }}>
                                {avail.count
                                  ? `${avail.count} chauffeur${avail.count > 1 ? "s" : ""} disponible${avail.count > 1 ? "s" : ""}${avail.etaMinutes ? ` · ${avail.etaMinutes} min` : ""}`
                                  : "Aucun chauffeur disponible"}
                              </span>
                            )}
                          </span>
                          <span className="flex-col" style={{ alignItems: "flex-end", flexShrink: 0 }}>
                            <span className="small mono-nums" style={{ fontWeight: 700 }}>{money(fare.total)}</span>
                            {estimate.showPriorityPriceSource === true && (
                              <span className="tiny muted" data-testid="priority-fare-source" style={{display:"block",textAlign:"right"}}>
                                {fare.isUberPrice ? "Prix Uber" : fare.priceSource === "ai" || fare.isAiPrice ? "Prix IA" : "Prix Admin"}
                              </span>
                            )}
                            {fare.discount > 0 && (
                              <span className="tiny muted mono-nums" style={{ textDecoration: "line-through" }}>
                                {money(fare.originalTotal)}
                              </span>
                            )}
                          </span>
                        </div>
                        <button type="button" className="rider-vehicle-arrow" aria-label="Catégorie suivante"
                          disabled={index === types.length - 1} onClick={() => changeType(index + 1)}>
                          <ChevronRight size={22} />
                        </button>
                        <span className="rider-vehicle-carousel-count">{index + 1} / {types.length}</span>
                      </div>
                    );
                  })()}
                </div>

                {selectedFare?.discount > 0 && (
                  <div className="flex items-center justify-between mt-4 tiny">
                    <span style={{ fontWeight: 600 }}>
                      Remise de {Math.round(selectedFare.discountRate * 100)} % appliquée
                    </span>
                    <span className="mono-nums">−{money(selectedFare.discount)}</span>
                  </div>
                )}

                {selectedFare?.driverFloorSupplement > 0 && (
                  <div className="flex items-center justify-between mt-4 tiny muted">
                    <span>Inclut le complément de rémunération minimale du chauffeur</span>
                    <span className="mono-nums">+{money(selectedFare.driverFloorSupplement)}</span>
                  </div>
                )}

                {/* Mode de paiement — Symétrie parfaite Carte & Espèces */}
                <div className="rider-payment-options mt-4" role="radiogroup" aria-label="Mode de paiement">
                  {[
                    {
                      id: "card",
                      icon: CreditCard,
                      label: "Carte bancaire",
                      detail: "Apple Pay · Google Pay"
                    },
                    {
                      id: "cash",
                      icon: Banknote,
                      label: "Espèces",
                      detail: "Règlement au chauffeur"
                    },
                  ].map(({ id, icon: Icon, label, detail }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={paymentMethod === id}
                      onClick={() => setPaymentMethod(id)}
                      className={`rider-payment-option rider-payment-option--${id}`}
                    >
                      <span className="rider-payment-option-title">
                        <Icon size={18} /> {label}
                      </span>
                      <span className="rider-payment-detail">{detail}</span>
                    </button>
                  ))}
                </div>
                {paymentMethod === "cash" && (
                  <p className="tiny muted text-center mt-1">Règlement direct en espèces au chauffeur</p>
                )}

                {insufficientWallet && paymentMethod === "card" && (
                  <p className="booking-notice tiny mt-2" role="status">
                    {payProblem} —{" "}
                    <Link href="/wallet" style={{ fontWeight: 700, textDecoration: "underline" }}>
                      ouvrir le portefeuille
                    </Link>
                  </p>
                )}

                {insufficientWallet && paymentMethod !== "card" && (
                  <p className="booking-notice tiny mt-2" role="status">
                    Solde du portefeuille insuffisant —{" "}
                    <Link href="/wallet" style={{ fontWeight: 700, textDecoration: "underline" }}>
                      {" "}
                      ajoutez des fonds{" "}
                    </Link>{" "}
                    pour réserver cette course.
                  </p>
                )}

                <button
                  className="btn btn-primary btn-lg btn-full mt-4 rider-book-button"
                  onClick={handleBook}
                  disabled={booking || insufficientWallet || noDriverForSelected}
                >
                  {booking ? (
                    <span className="spinner" />
                  ) : noDriverForSelected ? (
                    <>Aucun chauffeur disponible</>
                  ) : insufficientWallet ? (
                    <>Solde à compléter</>
                  ) : paymentMethod === "card" ? (
                    <>
                      <CreditCard size={18} /><span>Payer et réserver</span><span className="booking-button-amount">{money(selectedFare?.total || 0)}</span>
                    </>
                  ) : (
                    <>
                      <span>Commander et payer</span><span className="booking-button-amount">{money(selectedFare?.total || 0)}</span>
                    </>
                  )}
                </button>
                <p className="tiny muted text-center mt-2">Prix TTC garanti avant commande · <Link href="/terms" style={{ textDecoration: "underline" }}>Conditions d’annulation applicables</Link></p>
              </>
            )}
          </div>
        )}

        {/* ── SEARCHING ── */}
        {phase === "searching" && (
          <div className="card card-pad animate-in text-center">
            <div
              className="pulse-ring"
              style={{
                width: 64,
                height: 64,
                margin: "12px auto 20px",
                borderRadius: "50%",
                background: "var(--ink-950)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Car size={26} color="#fff" />
            </div>
            <h3 style={{ fontSize: "1.15rem" }}>Recherche de votre chauffeur…</h3>
            <p className="small muted mt-1">
              {offersSent > 0
                ? `Nous contactons les chauffeurs à proximité (${offersSent} contactés)`
                : "Nous contactons les chauffeurs proches de votre point de prise en charge"}
            </p>
            <button className="btn btn-secondary btn-full mt-6" onClick={() => setCancelOpen(true)}>
              {" "}
              Annuler la demande{" "}
            </button>
          </div>
        )}

        {/* ── ACTIVE ── */}
        {phase === "active" && ride && (
          <div className="card card-pad animate-in rider-active-card">
            <div className="rider-safety-actions"><RideSafety ride={ride}/><ReportDriverButton key={ride.id} ride={ride}/></div>
            {ride.status !== "in_progress" && (
              <div className="rider-trip-toolbar">
                <strong>Votre course</strong>
                <button type="button" className="rider-cancel-button" onClick={() => setCancelOpen(true)} disabled={cancelling}>
                  <X size={16} /> Annuler la course
                </button>
              </div>
            )}
            <div className="flex items-center justify-between mb-3 wrap gap-2">
              <span className={`badge badge-dot ${ride.status === "in_progress" ? "badge-info" : "badge-gold"}`}>
                {ride.status === "accepted" &&
                  (liveTrip
                    ? `Chauffeur à ${liveTrip.approximate ? "~" : ""}${liveTrip.minutes} min`
                    : etaMinutes
                      ? `Arrivée du chauffeur dans ~${etaMinutes} min`
                      : "Chauffeur en route")}
                {ride.status === "arrived" && "Votre chauffeur est là"}
                {ride.status === "in_progress" &&
                  (liveTrip
                    ? `${liveTrip.approximate ? "~" : ""}${liveTrip.minutes} min jusqu’à destination`
                    : "En route vers la destination")}
              </span>
              {liveTrip && (
                <span className="tiny muted mono-nums">
                  {formatDistance(liveTrip.meters)} {liveTrip.toDestination ? "restants" : "de distance"}
                </span>
              )}
            </div>
            {liveTrip && (
              <div className="flex items-center justify-between mb-2 tiny" style={{ gap: 8 }}>
                <span style={{ color: liveTrip.approximate ? "#fcd34d" : "#e2e8f0" }}>
                  {liveTrip.quality}
                </span>
                <span className="mono-nums" style={{ fontWeight: 700 }}>
                  {liveTrip.toDestination ? "Arrivée à destination" : "Chauffeur là"} vers{" "}
                  {arrivalClock(liveTrip.seconds)}
                </span>
              </div>
            )}

            {/* Live trip progress */}
            {liveTrip && (
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "var(--ink-100)",
                  overflow: "hidden",
                  marginBottom: 14,
                }}
                aria-hidden="true"
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    background: "linear-gradient(90deg, var(--ink-900), var(--gold-600))",
                    width: `${Math.max(
                      4,
                      Math.min(
                        96,
                        liveTrip.toDestination
                          ? 100 - (liveTrip.meters / Math.max(1, ride.route?.distanceMeters || 1)) * 100
                          : 100 - Math.min(100, (liveTrip.meters / 3000) * 100),
                      ),
                    )}%`,
                    transition: "width 900ms var(--ease)",
                  }}
                />
              </div>
            )}

            {ride.driver && (
              <div className="rider-active-driver flex items-center gap-3 mb-4">
                <Avatar name={ride.driver.name} src={ride.driver.avatar} size="lg" />
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }} className="truncate">
                    {ride.driver.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <Stars value={ride.driver.rating} />
                    <span className="tiny muted">{ride.driver.totalTrips} courses</span>
                  </div>
                </div>
                <div className="rider-active-vehicle text-right">
                  <div className="small" style={{ fontWeight: 700 }}>
                    {ride.driver.vehicle?.color} {ride.driver.vehicle?.make} {ride.driver.vehicle?.model}
                  </div>
                  <div className="badge badge-neutral mono-nums" style={{ marginTop: 4 }}>
                    {ride.driver.vehicle?.plate}
                  </div>
                </div>
              </div>
            )}

            {(ride.status === "accepted" || ride.status === "arrived") && ride.pin && (
              <div
                className="rider-active-pin flex items-center justify-between card-pad mb-4"
                style={{ background: "var(--gold-50)", borderRadius: 12, padding: "12px 16px" }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} style={{ color: "var(--gold-700)" }} />
                  <span className="small" style={{ fontWeight: 600 }}>
                    Votre code PIN
                  </span>
                </div>
                <button
                  className="flex items-center gap-2"
                  onClick={() => {
                    navigator.clipboard?.writeText(ride.pin);
                    toast("Code PIN copié", "info", 1500);
                  }}
                  aria-label="Copier le code PIN"
                  style={{ fontWeight: 800, fontSize: "1.3rem", letterSpacing: "0.25em", color: "var(--gold-700)" }}
                >
                  {ride.pin} <Copy size={14} />
                </button>
              </div>
            )}

            <div className="rider-active-addresses flex-col gap-2 small" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div className="flex gap-2">
                <Circle size={14} style={{ marginTop: 4, color: "var(--gold-600)", flexShrink: 0 }} />
                <span className="truncate muted">{ride.pickup.address}</span>
              </div>
              <div className="flex gap-2">
                <MapPin size={14} style={{ marginTop: 4, color: "var(--gold-600)", flexShrink: 0 }} />
                <span className="truncate muted">{ride.dropoff.address}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="muted">Course</span>
                <span className="mono-nums">
                  {formatDistance(ride.route?.distanceMeters || 0)} · {ride.route?.approximate ? "~" : ""}
                  {formatDuration(ride.route?.durationSeconds || 0)} de trajet
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="muted">Tarif (portefeuille)</span>
                <span className="mono-nums" style={{ fontWeight: 700 }}>
                  {money(ride.fare?.total)}
                </span>
              </div>
            </div>

            <div className="rider-active-chat flex gap-2 mt-4">
              <button
                className={`btn flex-1 ${unread > 0 ? "chat-btn-unread" : "btn-secondary"}`}
                onClick={() => {
                  setChatOpen(true);
                  setUnread(0);
                  setLastMsg(null);
                }}
                style={{ position: "relative" }}
              >
                <MessageCircle size={17} />{" "}
                {unread > 0 ? (unread > 1 ? `${unread} nouveaux messages` : "Nouveau message") : "Discussion"}
                {unread > 0 && <span className="chat-unread-badge mono-nums">{unread}</span>}
              </button>

            </div>

            {ride.status === "arrived" && (
              <p className="tiny muted mt-3 text-center">
                {" "}
                Une annulation maintenant entraîne des frais d’annulation tardive de 3,00 €{" "}
              </p>
            )}
          </div>
        )}

        {loadingActive && (
          <div className="card card-pad">
            <div className="skeleton" style={{ height: 22, width: "55%", marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 46, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 46 }} />
          </div>
        )}
      </div>

      {phase === "active" && ride && !chatOpen && (
        <MessageAlert
          message={lastMsg}
          count={unread}
          fromLabel={ride.driver?.name || "Votre chauffeur"}
          onOpen={() => {
            setChatOpen(true);
            setUnread(0);
            setLastMsg(null);
          }}
          onDismiss={() => setLastMsg(null)}
        />
      )}

      {/* Chat */}
      {phase === "active" && ride && (
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
        {ride?.status === "arrived" && (
          <p className="small mb-3">Des frais d’annulation tardive peuvent s’appliquer : 3,00 € selon les conditions de la course.</p>
        )}
        <div className="flex-col gap-2">
          {CANCEL_REASONS.map((r) => (
            <button key={r} className="vehicle-row" onClick={() => handleCancel(r)} disabled={cancelling}>
              <span className="small">{r}</span>
            </button>
          ))}
          <button className="btn btn-danger btn-full mt-2" onClick={() => handleCancel("")} disabled={cancelling}>
            {cancelling ? <span className="spinner" /> : "Annuler sans motif"}
          </button>
          <button className="btn btn-ghost btn-full" onClick={() => setCancelOpen(false)}>
            {" "}
            Conserver ma course{" "}
          </button>
        </div>
      </Modal>

      {/* Receipt + rating */}
      <Modal
        open={Boolean(completedRide)}
        onClose={() => {
          clearCompleted();
          refreshWallet();
        }}
        title="Course terminée"
      >
        {completedRide && (
          <div className="flex-col gap-4">
            <div className="card card-pad" style={{ background: "var(--ink-50)", border: "none" }}>
              <div className="flex items-center justify-between small">
                <span className="muted">Prise en charge + distance + durée</span>
                <span className="mono-nums">
                  {money(
                    (completedRide.fare?.baseFare || 0) +
                      (completedRide.fare?.distanceFare || 0) +
                      (completedRide.fare?.timeFare || 0),
                  )}
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
                style={{ borderTop: "1px solid var(--border)", paddingTop: 10, fontWeight: 700 }}
              >
                <span>Total ({paymentMethodLabel(completedRide.payment?.method)})</span>
                <span className="mono-nums">{money(completedRide.fare?.total)}</span>
              </div>
            </div>

            {completedRide.shortfall && (
              <p className="small" style={{ color: "var(--warning)", fontWeight: 600 }}>
                {" "}
                Le montant de cette course a dépassé le solde de votre portefeuille. Rechargez-le pour régler le montant
                dû avant votre prochaine course.{" "}
              </p>
            )}

            <div className="text-center">
              <p className="small muted mb-2">
                Comment s’est passée votre course{completedRide.driver ? ` avec ${completedRide.driver.name}` : ""} ?
              </p>
              <StarPicker value={rating} onChange={setRating} />
              {completedRide.driver?.id && (
                <div className="mt-3 flex justify-center">
                  <FavoriteRideChoice driver={completedRide.driver} onSave={saveFavorite} />
                </div>
              )}
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
              onClick={
                rating > 0
                  ? handleRate
                  : () => {
                      clearCompleted();
                      refreshWallet();
                    }
              }
              disabled={submittingRating}
            >
              {submittingRating ? <span className="spinner" /> : rating > 0 ? "Envoyer la note" : "Terminé"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Réserver une course · StrasDrive" },
      {
        name: "description",
        content: "StrasDrive — réserver une course, service de mise en relation VTC et tarifs en euros.",
      },
      { property: "og:title", content: "Réserver une course · StrasDrive" },
      {
        property: "og:description",
        content: "StrasDrive — réserver une course, service de mise en relation VTC et tarifs en euros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RiderLayout>
      <RiderDashboard />
    </RiderLayout>
  ),
});
