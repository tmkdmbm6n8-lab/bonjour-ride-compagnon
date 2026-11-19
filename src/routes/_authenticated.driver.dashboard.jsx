import CloseControl from "@/components/ui/CloseControl";
import { ShieldAlert } from "lucide-react";
import RidePauseButton from "@/components/driver/RidePauseButton";
import FinishRideButton from "@/components/driver/FinishRideButton";
import RideSafety from "@/components/ride/RideSafety";
import { clock as transportClock } from "@/lib/vtc-dates";
import { createFileRoute } from "@tanstack/react-router";
import DriverLayout from "@/components/DriverLayout";
import { apiFetch as fetch } from "@/lib/archive-fetch";
("use client");

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/lib/archive-navigation";
import {
  Power,
  Navigation,
  Radar,
  MapPin,
  Circle,
  MessageCircle,
  X,
  CheckCircle2,
  KeyRound,
  Flag,
  PawPrint,
  Star,
  Phone,
  FileText,
  Hand,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import useGeolocation from "@/hooks/useGeolocation";

import MapView from "@/components/ArchiveMap";
import ChatSheet from "@/components/ride/ChatSheet";
import MessageAlert from "@/components/ride/MessageAlert";
import { whenChatMessageReady } from "@/lib/chat-media-cache";
import DispatchWheel from "@/components/ride/DispatchWheel";
import Waybill from "@/components/driver/Waybill";
import DriverHome from "@/components/driver/DriverHome";
import PassengerInfo from "@/components/driver/PassengerInfo";
import { pickupZoneProblem, ARRIVAL_ZONE_METERS } from "@/lib/vtc-dispatch";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { money, VEHICLE_LABELS } from "@/components/ui/bits";
import useDriverState from "@/hooks/useDriverState";
import { formatDistance, formatDuration, roadDistanceMeters, etaMinutes as etaFor } from "@/lib/utils/geo";
import { playSound, startRinging } from "@/lib/sounds";
import ExternalNavigationButton from "@/components/driver/ExternalNavigationButton";
import { useLiveRoute } from "@/hooks/useLiveRoute";
import { driverOfferActivity } from "@/lib/live-activity";
import { syncLiveActivity, stopLiveActivity } from "@/lib/live-activity-native";
import useRouteRadars from "@/hooks/useRouteRadars";
import { routeQualityLabel } from "@/lib/vtc-routing";
import { drawableRoute, arrivalClock } from "@/lib/utils/route-display";

const PROFIT_BADGES = {
  very_profitable: { label: "Très rentable", className: "badge-success" },
  profitable: { label: "Rentable", className: "badge-info" },
  not_profitable: { label: "Non rentable", className: "badge-danger" },
};

function DriverDashboard() {
  const toast = useToast();
  const [waybillOpen, setWaybillOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [arrivalNotice, setArrivalNotice] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const [receipt, setReceipt] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [unread, setUnread] = useState(0);
  const [lastMsg, setLastMsg] = useState(null);
  const [award, setAward] = useState(null); // null | 'spinning' | 'won' | 'lost'
  const chatOpenRef = useRef(false);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  const onEvent = useCallback(
    (type, data) => {
      if ((type === "offer" || type === "offer-updated") && data?.airportReturn)
        toast(
          `Course Gold · ${data.airportReturn.kind === "train" ? "train" : "vol"} ${data.airportReturn.flightNumber} à ${transportClock(data.airportReturn.arrivalAt)}`,
          "info",
          7000,
        );
      if (type === "offer-expired") toast("Demande expirée", "info", 2500);
      if (type === "offer-withdrawn") toast("La demande a été annulée", "info", 2500);
      if (type === "rider-cancelled") {
        toast(
          data?.compensation
            ? `Le passager a annulé — une indemnité de ${money(data.compensation)} a été ajoutée`
            : "Le passager a annulé la course",
          "info",
          5000,
        );
      }
      if (type === "message" && data?.from === "rider") {
        whenChatMessageReady(data.rideId, data).then(() => {
          playSound("message");
          if (!chatOpenRef.current) {
            setUnread((u) => u + 1);
            setLastMsg(data);
            if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
          }
        });
      }
      if (type === "rider-cancelled" || type === "offer-withdrawn") playSound("cancelled");
    },
    [toast],
  );

  const {
    loading,
    profile,
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
  } = useDriverState({ onEvent });

  useEffect(() => {
    if (loading) return;
    const activity = driverOfferActivity(offer);
    if (activity) void syncLiveActivity(activity);
    else void stopLiveActivity('driver_offer');
  }, [loading, offer?.rideId, offer?.receivedAt, offer?.expiresInSeconds, offer?.etaMinutes, offer?.durationSeconds, offer?.earnings]);

  // A single local fix keeps the idle map centered, without road-alert polling or sounds.
  const { position: idlePosition } = useGeolocation({ watch: false });

  // Keep incoming ride notifications independent from removed radar sounds.
  useEffect(() => {
    if (!offer?.rideId) return undefined;
    return startRinging("offer");
  }, [offer?.rideId]);

  // Offer countdown
  useEffect(() => {
    if (!offer) {
      setCountdown(0);
      return undefined;
    }
    const expires = offer.receivedAt + (offer.expiresInSeconds || 15) * 1000;
    const tick = () => setCountdown(Math.max(0, Math.ceil((expires - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [offer]);

  const canAccept = true;

  async function handleToggle() {
    try {
      if (online) await goOffline();
      else {
        await goOnline();
        // Toast d'information supprimé
      }
    } catch (err) {
      if (err.code === "NO_VEHICLE") {
        toast("Ajoutez d’abord les informations de votre véhicule", "error", 5000);
      } else {
        toast(err.message, "error", 5000);
      }
    }
  }

  async function handleAccept() {
    if (actionBusy) return;
    setActionBusy(true);
    setAward("spinning");
    const spin = new Promise((r) => setTimeout(r, 1500));
    try {
      await Promise.all([accept(), spin]);
      setUnread(0);
      setLastMsg(null);
      setAward("won");
      playSound("driver-found");
    } catch (err) {
      await spin;
      if (/déjà acceptée|plus disponible/i.test(err.message || "")) {
        setAward("lost");
        playSound("cancelled");
      } else {
        setAward(null);
        toast(err.message, "error", 4000);
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function run(fn, success) {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await fn();
      if (success) toast(success, "success");
    } catch (err) {
      toast(err.message, "error", 4000);
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
      setPinValue("");
      toast("Course démarrée", "success");
    } catch (err) {
      toast(err.message, "error", 4000);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleArrive() {
    if (actionBusy || !ride) return;
    setActionBusy(true);
    try {
      if (!navigator.geolocation) throw new Error("Position GPS introuvable — activez la localisation");
      const location = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          (fix) => resolve({ lat: fix.coords.latitude, lng: fix.coords.longitude }),
          () => reject(new Error("Position GPS introuvable — activez la localisation et réessayez.")),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
        ),
      );
      const problem = pickupZoneProblem(location, ride.pickup, ARRIVAL_ZONE_METERS);
      if (problem) {
        setArrivalNotice(problem);
        return;
      }
      const res = await fetch("/api/drivers/location", { method: "POST", body: JSON.stringify(location) });
      const data = await res.json();
      if (!res.ok || data.ignored) throw new Error(data.error || "Impossible de transmettre votre position.");
      await arrive();
      toast("Le passager a été informé de votre arrivée", "success");
    } catch (error) {
      if (/GPS|localisation|prise en charge/i.test(error.message || "")) setArrivalNotice(error.message);
      else toast(error.message || "Impossible de signaler votre arrivée", "error", 4000);
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
      return true;
    } catch (err) {
      toast(err.message, "error", 4000);
      return false;
    } finally {
      setActionBusy(false);
    }
  }

  // Live navigation readout — traffic-aware time from the server (Google Routes),
  // with a rough on-device estimate until the first answer arrives.
  const liveRoute = useLiveRoute(ride?.id, ride?.status);
  const driverRoute = useMemo(
    () =>
      drawableRoute(liveRoute?.status === ride?.status ? liveRoute?.geometry : null, liveRoute?.source) ||
      (ride?.status === "in_progress" ? drawableRoute(ride.route?.geometry, ride.route?.source) : undefined),
    [liveRoute, ride?.status, ride?.route],
  );
  const routeRadars = useRouteRadars(ride?.id, ride?.status, driverRoute, position);
  const liveLeg = useMemo(() => {
    if (!ride || (ride.status !== "accepted" && ride.status !== "in_progress")) return null;
    const label = ride.status === "in_progress" ? "jusqu’à destination" : "jusqu’au point de prise en charge";
    if (liveRoute?.status === ride.status) {
      return {
        meters: liveRoute.distanceMeters,
        minutes: Math.max(1, Math.round(liveRoute.durationSeconds / 60)),
        seconds: liveRoute.durationSeconds,
        label,
        quality: routeQualityLabel(liveRoute),
        approximate: liveRoute.approximate,
      };
    }
    if (!position) return null;
    const target = ride.status === "in_progress" ? ride.dropoff : ride.pickup;
    const meters = roadDistanceMeters(position, { lat: target.lat, lng: target.lng });
    return {
      meters,
      minutes: etaFor(meters),
      seconds: etaFor(meters) * 60,
      label,
      quality: "Calcul de l’itinéraire…",
      approximate: true,
    };
  }, [ride, position, liveRoute]);

  // Pickup zone: "arrived" and "start" stay disabled until the driver is close to the pickup point.
  const zoneProblem =
    ride && !ride.isTest && ["accepted", "arrived"].includes(ride.status)
      ? pickupZoneProblem(position, ride.pickup)
      : null;

  // In-app navigation leg: driver → pickup, then driver → destination
  const legTarget = ride
    ? ride.status === "in_progress"
      ? { lat: ride.dropoff.lat, lng: ride.dropoff.lng }
      : ride.status === "accepted"
        ? { lat: ride.pickup.lat, lng: ride.pickup.lng }
        : null
    : null;
  const navigating = Boolean(legTarget);
  const needsVehicle = profile && !profile.vehicle?.plate;
  const center = position || { lat: 48.5734, lng: 7.7521 }; // Strasbourg par défaut

  const [togglingPet, setTogglingPet] = useState(false);
  const acceptsPet = (profile?.acceptsClasses || []).includes("pet");

  async function handleTogglePet() {
    setTogglingPet(true);
    const current = profile?.acceptsClasses || [];
    const next = acceptsPet ? current.filter((c) => c !== "pet") : [...current, "pet"];
    try {
      const res = await fetch("/api/drivers/me/classes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptsClasses: next }),
      });
      const data = await res.json();
      if (!res.ok) toast(data.error || "Erreur de mise à jour", "error");
      else {
        toast(
          next.includes("pet")
            ? "StrasDrive Pet activé : vous recevrez les courses avec animaux"
            : "StrasDrive Pet désactivé",
          "success",
        );
        window.location.reload();
      }
    } catch {
      toast("Erreur de connexion", "error");
    } finally {
      setTogglingPet(false);
    }
  }
  const [togglingCash, setTogglingCash] = useState(false);
  const acceptsCash = profile?.tripPrefs?.acceptCash !== false;

  async function handleToggleCash() {
    setTogglingCash(true);
    const next = !acceptsCash;
    try {
      const res = await fetch("/api/drivers/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripPrefs: { acceptCash: next } }),
      });
      const data = await res.json();
      if (!res.ok) toast(data.error || "Erreur de mise à jour", "error");
      else {
        toast(next ? "Paiements en espèces activés" : "Paiements en espèces désactivés", "success");
        if (profile?.tripPrefs) profile.tripPrefs.acceptCash = next;
      }
    } catch {
      toast("Erreur de connexion", "error");
    } finally {
      setTogglingCash(false);
    }
  }

  return (
    <>
      {profile?.isReportSuspended ? (
        <section className="driver-suspension-screen" role="status">
          <ShieldAlert size={48} aria-hidden="true" />
          <h1>Compte chauffeur suspendu</h1>
          <p>Votre activité chauffeur est suspendue à cause de plusieurs signalements. Contactez l’assistance.</p>
          <Link href="/contact?topic=driver_support" className="btn btn-primary btn-full">
            Contacter l’assistance
          </Link>
          <Link href="/dashboard" className="btn btn-secondary btn-full">
            Passer en mode passager
          </Link>
          {ride && ["accepted", "arrived"].includes(ride.status) && (
            <button className="btn btn-secondary btn-full" onClick={() => setCancelOpen(true)}>
              Annuler la course en attente
            </button>
          )}
          {ride?.status === "in_progress" && <FinishRideButton onConfirm={handleComplete} disabled={actionBusy} />}
        </section>
      ) : ride ? (
        <div className="drv-active-ride-page">
          {/* 1. Carte de course OpenStreetMap en plein écran */}
          <div className="map-fill" style={{ position: "absolute", inset: 0 }}>
            <MapView
              center={center}
              zoom={16.5}
              userPosition={position || undefined}
              pickup={ride ? { lat: ride.pickup.lat, lng: ride.pickup.lng } : undefined}
              dropoff={
                ride && ride.status === "in_progress" ? { lat: ride.dropoff.lat, lng: ride.dropoff.lng } : undefined
              }
              routeGeometry={driverRoute}
              fit
              fitTo={[position, ride.status === "in_progress" ? ride.dropoff : ride.pickup].filter(Boolean)}
              navigationMode={false}
            />
          </div>

          {/* 2. Tout en haut : Fiche passager opaque */}
          <div className="drv-top-passenger-bar">
            <PassengerInfo key={ride.id} ride={ride} />

            <div className="drv-client-actions">
              {ride.rider?.phone && (
                <a href={`tel:${ride.rider.phone}`} className="drv-circle-btn is-call" title="Appeler">
                  <Phone size={18} />
                </a>
              )}
              <button
                className={`drv-circle-btn ${unread > 0 ? "has-unread" : ""}`}
                onClick={() => {
                  setChatOpen(true);
                  setUnread(0);
                  setLastMsg(null);
                }}
                title="Message"
              >
                <MessageCircle size={18} />
                {unread > 0 && <span className="drv-badge-dot" />}
              </button>
              <button className="drv-circle-btn" onClick={() => setWaybillOpen(true)} title="Feuille de route légale">
                <FileText size={18} />
              </button>
            </div>
          </div>

          {/* 3. Au-dessus du volet bas : Pause 2 min à gauche / Annuler à droite */}
          <div className="drv-ride-dock">
            <div className="drv-mid-actions-bar">
              <RidePauseButton key={ride.id} rideId={ride.id} />

              {ride.status !== "in_progress" && (
                <button className="drv-action-pill drv-cancel-pill" onClick={() => setCancelOpen(true)}>
                  <X size={16} />
                  <span>Annuler</span>
                </button>
              )}
            </div>

            {/* 4. Tout en bas : Volet rétractable d'informations centré */}
            <div className="drv-bottom-sheet is-minimal">
              <div className="drv-sheet-header">
                <div>
                  <span className="drv-sheet-stage">
                    {ride.status === "accepted"
                      ? "Vers le passager"
                      : ride.status === "arrived"
                        ? "Passager prévenu"
                        : "Course en cours"}
                  </span>
                  <strong className="drv-sheet-earnings mono-nums">{money(ride.fare?.driverEarnings)}</strong>
                </div>
                <button
                  className="drv-sheet-toggle"
                  aria-expanded={detailsOpen}
                  aria-controls="active-ride-details"
                  onClick={() => setDetailsOpen(!detailsOpen)}
                >
                  Détails {detailsOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
              <p className="drv-sheet-address">
                {ride.status === "in_progress" ? ride.dropoff.address : ride.pickup.address}
              </p>

              {navigating && (
                <div className="drv-sheet-summary">
                  {liveLeg && (
                    <span>
                      {formatDuration(liveLeg.seconds)} · {formatDistance(liveLeg.meters)}
                      {liveLeg.approximate ? " · estimé" : ""}
                    </span>
                  )}
                  <span className={`drv-sheet-radar-pill ${routeRadars.count > 0 ? "has-radars" : ""}`} role="status">
                    <Radar size={15} aria-hidden="true" />
                    {routeRadars.count == null
                      ? routeRadars.loading
                        ? "Radars…"
                        : "Radars indisponibles"
                      : `${routeRadars.count} radar${routeRadars.count > 1 ? "s" : ""}`}
                  </span>
                </div>
              )}
              {navigating && (!position || !driverRoute) && (
                <p className="drv-sheet-route-status" role="status">
                  {!position
                    ? "En attente du GPS…"
                    : liveRoute?.approximate
                      ? "Itinéraire indisponible · nouvelle tentative…"
                      : "Calcul du trajet…"}
                </p>
              )}

              {/* Volet dépliable avec tous les détails */}
              {detailsOpen && (
                <div className="drv-sheet-details" id="active-ride-details">
                  <RideSafety ride={ride} />
                  <div className="flex justify-between items-center mb-2 text-sm text-muted">
                    <span>Prise en charge :</span>
                    <span className="text-white truncate max-w-[220px]">{ride.pickup.address}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2 text-sm text-muted">
                    <span>Destination :</span>
                    <span className="text-white truncate max-w-[220px]">{ride.dropoff.address}</span>
                  </div>
                  {ride.payment?.method === "cash" && (
                    <div className="drv-cash-alert mb-3">
                      <span>Espèces à encaisser :</span>
                      <strong>{money(ride.fare?.total)}</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="drv-sheet-actions">
                {legTarget && <ExternalNavigationButton key={`${ride.id}:${ride.status}`} destination={legTarget} />}

                {/* Gros bouton d'action principal */}
                {ride.status === "accepted" && (
                  <button
                    className="btn btn-primary btn-lg btn-full drv-arrival-button"
                    onClick={handleArrive}
                    disabled={actionBusy}
                  >
                    <Flag size={18} /> Je suis arrivé
                  </button>
                )}
                {ride.status === "arrived" && (
                  <button
                    className="btn btn-primary btn-lg btn-full"
                    onClick={() => setPinOpen(true)}
                    disabled={actionBusy || Boolean(zoneProblem)}
                  >
                    <KeyRound size={18} /> Saisir le PIN pour démarrer
                  </button>
                )}
                {ride.status === "in_progress" && (
                  <FinishRideButton key={ride.id} onConfirm={handleComplete} disabled={actionBusy} />
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <DriverHome
            onWaybill={() => setWaybillOpen(true)}
            loading={loading}
            online={online}
            busy={busy}
            isConnected={isConnected}
            needsVehicle={needsVehicle}
            position={position || idlePosition}
            center={center}
            onToggle={handleToggle}
            acceptsPet={acceptsPet}
            togglingPet={togglingPet}
            onTogglePet={handleTogglePet}
            acceptsCash={acceptsCash}
            togglingCash={togglingCash}
            onToggleCash={handleToggleCash}
          />
        </>
      )}

      <Waybill open={waybillOpen} onClose={() => setWaybillOpen(false)} />
      <Modal
        open={Boolean(arrivalNotice)}
        onClose={() => setArrivalNotice("")}
        title="Zone de prise en charge"
        portal
        keyboardSafe
        sheetOnMobile={false}
      >
        <p role="alert">
          {arrivalNotice.startsWith("Rapprochez-vous")
            ? "Vous n’êtes pas dans la zone de prise en charge. Approchez-vous à moins de 20 mètres, puis réessayez."
            : arrivalNotice}
        </p>
        <button type="button" className="btn btn-secondary btn-full mt-4" onClick={() => setArrivalNotice("")}>
          Retour
        </button>
      </Modal>
      {award && <DispatchWheel status={award} onDone={() => setAward(null)} />}

      {/* ── Notification de course : Cockpit StrasDrive (Design Original) ── */}
      <Modal open={Boolean(offer) && !profile?.isReportSuspended} onClose={decline} closable={false}>
        {offer && (
          <div
            style={{
              background: "linear-gradient(180deg, #13151f 0%, #0a0b10 100%)",
              color: "#ffffff",
              borderRadius: 24,
              padding: "24px 20px 20px",
              margin: "-16px -16px",
              border: "1px solid rgba(212, 160, 23, 0.25)",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(212, 160, 23, 0.12)",
            }}
          >
            <div className="driver-offer-preview" aria-label="Aperçu du trajet proposé">
              <div className="driver-offer-map">
                <MapView
                  key={offer.rideId}
                  center={offer.pickup}
                  pickup={offer.pickup}
                  dropoff={offer.dropoff}
                  routeGeometry={drawableRoute(offer.routeGeometry)}
                  fit
                  fitTo={[offer.pickup, offer.dropoff]}
                  compact
                />
              </div>
              <div className="driver-offer-legend">
                <span>
                  <i className="offer-pickup-dot" /> Prise en charge
                </span>
                <span>
                  <i className="offer-dropoff-dot" /> Dépôt
                </span>
              </div>
            </div>
            {/* 1. En-tête : Badge StrasDrive Or + Bouton Ignorer */}
            <div className="flex items-center justify-between mb-4">
              <div
                style={{
                  background: "rgba(212, 160, 23, 0.15)",
                  color: "#facc15",
                  border: "1px solid rgba(212, 160, 23, 0.35)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  padding: "6px 14px",
                  borderRadius: 9999,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  letterSpacing: "0.02em",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#facc15" }} />
                <span>{offer.airportReturn ? "Course Gold" : (VEHICLE_LABELS[offer.rideClass] || "StrasDrive Go")}</span>
              </div>

              <CloseControl onClick={decline} disabled={actionBusy} label="Ignorer la course" />
            </div>

            {/* 2. Gain net en or géant */}
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div
                style={{
                  fontSize: "3rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  color: "#facc15",
                }}
              >
                {money(offer.profitability?.expectedEarnings ?? offer.earnings)}
              </div>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "#9ca3af",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Net chauffeur garanti
              </span>
            </div>

            {/* 3. Badges d'infos (Paiement, Note passager) */}
            <div className="flex justify-center gap-2 mb-5">
              <span
                style={{
                  background: offer.paymentMethod === "cash" ? "rgba(234, 179, 8, 0.15)" : "rgba(255, 255, 255, 0.05)",
                  color: offer.paymentMethod === "cash" ? "#facc15" : "#e5e7eb",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "4px 12px",
                  borderRadius: 10,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                {offer.paymentMethod === "cash" ? `Espèces (${money(offer.total)})` : "Portefeuille"}
              </span>

              <span
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "4px 12px",
                  borderRadius: 10,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Star size={12} fill="#facc15" stroke="#facc15" /> 5.0
              </span>
            </div>

            {/* 4. Trajet : Prise en charge & Destination */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: 16,
                padding: "14px 14px",
                marginBottom: 18,
              }}
            >
              <div className="flex gap-3 items-start mb-3">
                <Circle size={10} strokeWidth={3} style={{ color: "#4ade80", marginTop: 4, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#ffffff" }}>
                    Prise en charge ({offer.etaMinutes} min · {formatDistance(offer.distanceToPickupMeters)})
                  </div>
                  <div className="truncate" style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                    {offer.pickup.address}
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0 8px 18px" }} />

              <div className="flex gap-3 items-start">
                <MapPin size={11} style={{ color: "#facc15", marginTop: 3, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#ffffff" }}>
                    Destination ({formatDistance(offer.distanceMeters)} · {formatDuration(offer.durationSeconds)})
                  </div>
                  <div className="truncate" style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                    {offer.dropoff.address}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Bouton Accepter Doré avec décompte */}
            {(() => {
              const maxSec = offer.expiresInSeconds || 15;
              const progressPct = Math.max(0, Math.min(100, (countdown / maxSec) * 100));
              return (
                <div className="flex gap-3 driver-offer-actions">
                  <button
                    onClick={decline}
                    disabled={actionBusy}
                    style={{
                      flex: "0 0 80px",
                      height: 52,
                      borderRadius: 14,
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#9ca3af",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Passer
                  </button>

                  <button
                    onClick={handleAccept}
                    disabled={actionBusy || countdown === 0}
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 14,
                      border: "none",
                      position: "relative",
                      overflow: "hidden",
                      fontWeight: 800,
                      fontSize: "1rem",
                      cursor: countdown === 0 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
                      color: "#0c0d12",
                      boxShadow: "0 8px 24px rgba(212, 160, 23, 0.35)",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${progressPct}%`,
                        background: "rgba(255, 255, 255, 0.25)",
                        transition: "width 0.25s linear",
                        zIndex: 1,
                      }}
                    />
                    <span style={{ position: "relative", zIndex: 2 }}>
                      {actionBusy ? (
                        <span className="spinner" />
                      ) : countdown === 0 ? (
                        "Expirée"
                      ) : (
                        `Accepter (${countdown}s)`
                      )}
                    </span>
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* ── PIN entry ── */}
      <Modal open={pinOpen} onClose={() => setPinOpen(false)} title="Code PIN du passager" keyboardSafe>
        <p className="small muted mb-4">Demandez au passager son code PIN à 4 chiffres pour démarrer la course.</p>
        <input
          className="input text-center mono-nums"
          style={{ fontSize: "2.2rem", letterSpacing: "0.5em", fontWeight: 800, minHeight: 64, color: "var(--text)" }}
          value={pinValue}
          onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
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
          {actionBusy ? (
            <span className="spinner" />
          ) : (
            <>
              <Navigation size={17} /> Démarrer la course
            </>
          )}
        </button>
      </Modal>

      {/* ── Modale d'annulation avec motifs et notification passager ── */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Motif de l'annulation">
        <p className="small muted mb-3">
          Sélectionnez la raison de l'annulation. Le passager recevra cette information directement.
        </p>

        {[
          "Passager introuvable au point de rendez-vous",
          "Problème ou panne mécanique du véhicule",
          "Raison de sécurité",
          "Adresse inaccessible ou erronée",
          "Autre",
        ].map((m) => (
          <button
            key={m}
            type="button"
            className={`drv-cancel-choice ${cancelReason === m ? "is-selected" : ""}`}
            onClick={() => setCancelReason(m)}
          >
            {m}
          </button>
        ))}

        {cancelReason === "Autre" && (
          <textarea
            className="input mb-3"
            rows={2}
            placeholder="Précisez la raison pour le passager..."
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
          />
        )}

        <div className="flex-col gap-2 mt-2">
          <button
            className="btn btn-danger btn-full"
            disabled={actionBusy || !cancelReason || (cancelReason === "Autre" && !customReason.trim())}
            onClick={() =>
              run(async () => {
                const finalReason = cancelReason === "Autre" ? customReason.trim() : cancelReason;
                await cancelTrip(finalReason);
                setCancelOpen(false);
                setCancelReason("");
                setCustomReason("");
              }, "Course annulée")
            }
          >
            {actionBusy ? <span className="spinner" /> : "Confirmer l'annulation"}
          </button>
          <button
            className="btn btn-ghost btn-full"
            onClick={() => {
              setCancelOpen(false);
              setCancelReason("");
              setCustomReason("");
            }}
          >
            Conserver la course
          </button>
        </div>
      </Modal>

      {/* ── Completion receipt ── */}
      <Modal open={Boolean(receipt)} onClose={() => setReceipt(null)} title="Course terminée 🎉">
        {receipt && (
          <div className="text-center">
            <div style={{ fontSize: "2.4rem", fontWeight: 800 }} className="mono-nums">
              {money(receipt.fare?.driverEarnings)}
            </div>
            <p className="small muted mt-1 mb-4">
              {receipt.isTest
                ? "Course test : rien n’a été versé sur votre portefeuille"
                : receipt.payment?.method === "cash"
                  ? `gagnés sur cette course · encaissez ${money(receipt.fare?.total)} en espèces, la commission est déduite de votre portefeuille`
                  : "gagnés sur cette course · versés sur votre portefeuille"}
            </p>
            <button className="btn btn-primary btn-full" onClick={() => setReceipt(null)}>
              {" "}
              Reprendre la conduite{" "}
            </button>
          </div>
        )}
      </Modal>

      {ride && !chatOpen && (
        <MessageAlert
          message={lastMsg}
          count={unread}
          fromLabel="Passager"
          onOpen={() => {
            setChatOpen(true);
            setUnread(0);
            setLastMsg(null);
          }}
          onDismiss={() => setLastMsg(null)}
        />
      )}

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
    </>
  );
}

export const Route = createFileRoute("/_authenticated/driver/dashboard")({
  head: () => ({
    meta: [
      { title: "Conduire · StrasDrive" },
      { name: "description", content: "StrasDrive — conduire, service de mise en relation VTC et tarifs en euros." },
      { property: "og:title", content: "Conduire · StrasDrive" },
      {
        property: "og:description",
        content: "StrasDrive — conduire, service de mise en relation VTC et tarifs en euros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <DriverLayout>
      <DriverDashboard />
    </DriverLayout>
  ),
});
