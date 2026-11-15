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
  MapPin,
  Circle,
  MessageCircle,
  X,
  Car,
  TrendingUp,
  CheckCircle2,
  KeyRound,
  Flag,
  PawPrint,
  Star,
  Square,
  User,
  Phone,
  FileText,
} from "lucide-react";

import MapView from "@/components/ArchiveMap";
import ChatSheet from "@/components/ride/ChatSheet";
import MessageAlert from "@/components/ride/MessageAlert";
import DispatchWheel from "@/components/ride/DispatchWheel";
import Waybill from "@/components/driver/Waybill";
import DriverHome from "@/components/driver/DriverHome";
import { pickupZoneProblem } from "@/lib/vtc-dispatch";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { money, VEHICLE_LABELS } from "@/components/ui/bits";
import useDriverState from "@/hooks/useDriverState";
import { formatDistance, formatDuration, roadDistanceMeters, etaMinutes as etaFor } from "@/lib/utils/geo";
import { playSound, startRinging } from "@/lib/sounds";
import { NAV_APPS, getNavApp, setNavApp, getNavAuto, setNavAuto, openNavigation } from "@/lib/navigation";
import { useLiveRoute } from "@/hooks/useLiveRoute";
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
  const [cancelOpen, setCancelOpen] = useState(false);

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
          `Retour potentiel possible · vol ${data.airportReturn.flightNumber} à ${transportClock(data.airportReturn.arrivalAt)}`,
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
        playSound("message");
        if (!chatOpenRef.current) {
          setUnread((u) => u + 1);
          setLastMsg(data);
          if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        }
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

  // Ring (Uber-style, repeated) while a ride request is on screen
  useEffect(() => {
    if (!offer?.rideId) return undefined;
    return startRinging("offer");
  }, [offer?.rideId]);

  // GPS app preference (Google Maps / Waze) and auto-launch
  const [navApp, setNavAppState] = useState("google");
  const [navAuto, setNavAutoState] = useState(true);
  useEffect(() => {
    setNavAppState(getNavApp());
    setNavAutoState(getNavAuto());
  }, []);
  const chooseNavApp = (app) => {
    setNavApp(app);
    setNavAppState(app);
  };
  const toggleNavAuto = () => {
    setNavAuto(!navAuto);
    setNavAutoState(!navAuto);
  };
  function launchGps(dest, auto = false) {
    if (auto && !navAuto) return;
    const opened = openNavigation(navApp, dest);
    if (!opened && auto) toast("Touchez « Lancer le GPS » pour ouvrir la navigation", "info", 5000);
  }

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
        toast("Vous êtes en ligne — vous recevrez des demandes", "success");
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
    const pickupPoint = offer?.pickup ? { lat: offer.pickup.lat, lng: offer.pickup.lng } : null;
    setAward("spinning");
    const spin = new Promise((r) => setTimeout(r, 1500));
    try {
      await Promise.all([accept(), spin]);
      setUnread(0);
      setLastMsg(null);
      setAward("won");
      playSound("driver-found");
      if (pickupPoint) launchGps(pickupPoint, true);
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
      if (ride?.dropoff) launchGps({ lat: ride.dropoff.lat, lng: ride.dropoff.lng }, true);
    } catch (err) {
      toast(err.message, "error", 4000);
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
      toast(err.message, "error", 4000);
    } finally {
      setActionBusy(false);
    }
  }

  // Live navigation readout — traffic-aware time from the server (Google Routes),
  // with a rough on-device estimate until the first answer arrives.
  const liveRoute = useLiveRoute(ride?.id, ride?.status);
  const liveLeg = useMemo(() => {
    if (!ride || (ride.status !== "accepted" && ride.status !== "in_progress")) return null;
    const label = ride.status === "in_progress" ? "jusqu’à destination" : "jusqu’au point de prise en charge";
    if (liveRoute) {
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
      {ride ? (
        <div className="ride-page drv-active-ride-page">
          <div className="map-fill">
            <MapView
              center={center}
              zoom={15}
              userPosition={position || undefined}
              pickup={ride ? { lat: ride.pickup.lat, lng: ride.pickup.lng } : undefined}
              dropoff={
                ride && ride.status === "in_progress" ? { lat: ride.dropoff.lat, lng: ride.dropoff.lng } : undefined
              }
              routeGeometry={
                drawableRoute(liveRoute?.geometry) ||
                (ride?.status === "in_progress" ? drawableRoute(ride.route?.geometry) : undefined)
              }
              fit={Boolean(ride)}
              followPosition={position || undefined}
            />
          </div>

          <div className="ride-panel drv-cockpit-ride-panel">
            {/* ── Fiche passager avec Appel direct & Waybill ── */}
            <div className="drv-client-card">
              <div className="drv-client-meta">
                <div className="drv-client-avatar">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="drv-client-name">{ride.rider?.name || "Passager"}</h3>
                  <span className="drv-client-rating">
                    ★ {ride.rider?.rating ? ride.rider.rating.toFixed(1) : "5.0"}
                  </span>
                </div>
              </div>

              <div className="drv-client-actions">
                {ride.rider?.phone ? (
                  <a href={`tel:${ride.rider.phone}`} className="drv-circle-btn is-call" title="Appeler le passager">
                    <Phone size={18} />
                  </a>
                ) : null}
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

            {/* ── Détails & Actions de la course ── */}
            <div className="drv-trip-card">
              <div className="flex items-center justify-between mb-3">
                <span className={`badge badge-dot ${ride.status === "in_progress" ? "badge-info" : "badge-gold"}`}>
                  {ride.status === "accepted" && "Rejoignez le passager"}
                  {ride.status === "arrived" && "Passager informé de votre arrivée"}
                  {ride.status === "in_progress" && "Course en cours"}
                </span>
                <span className="drv-trip-gain mono-nums">{money(ride.fare?.driverEarnings)}</span>
              </div>

              {ride.payment?.method === "cash" && (
                <div className="drv-cash-alert">
                  <span>Paiement en espèces</span>
                  <strong>À encaisser : {money(ride.fare?.total)}</strong>
                </div>
              )}

              {/* Navigation GPS intégrée */}
              {legTarget && (
                <div className="mb-3">
                  <button className="btn btn-secondary btn-full drv-gps-btn" onClick={() => launchGps(legTarget)}>
                    <Navigation size={17} /> GPS ({NAV_APPS[navApp]})
                  </button>
                </div>
              )}

              {/* Adresses */}
              <div className="drv-addresses mb-4">
                <div className="flex gap-2 items-start">
                  <Circle size={12} className="text-gold mt-1 flex-shrink-0" />
                  <span className="small text-muted">{ride.pickup.address}</span>
                </div>
                <div className="flex gap-2 items-start mt-2">
                  <MapPin size={12} className="text-gold mt-1 flex-shrink-0" />
                  <span className="small text-muted">{ride.dropoff.address}</span>
                </div>
              </div>

              {/* Bouton d'action principal */}
              {ride.status === "accepted" && (
                <button
                  className="btn btn-primary btn-lg btn-full"
                  onClick={() => run(arrive, "Le passager a été informé de votre arrivée")}
                  disabled={actionBusy || Boolean(zoneProblem)}
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
                <button className="btn btn-success btn-lg btn-full" onClick={handleComplete} disabled={actionBusy}>
                  <CheckCircle2 size={18} /> Terminer la course
                </button>
              )}

              {ride.status !== "in_progress" && (
                <button className="btn btn-danger btn-full mt-2" onClick={() => setCancelOpen(true)}>
                  <X size={16} /> Annuler la course
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <DriverHome
          onWaybill={() => setWaybillOpen(true)}
          loading={loading}
          online={online}
          busy={busy}
          isConnected={isConnected}
          needsVehicle={needsVehicle}
          position={position}
          center={center}
          onToggle={handleToggle}
          acceptsPet={acceptsPet}
          togglingPet={togglingPet}
          onTogglePet={handleTogglePet}
          acceptsCash={acceptsCash}
          togglingCash={togglingCash}
          onToggleCash={handleToggleCash}
        />
      )}

      <Waybill open={waybillOpen} onClose={() => setWaybillOpen(false)} />
      {award && <DispatchWheel status={award} onDone={() => setAward(null)} />}

      {/* ── Incoming offer sheet (Style moderne sombre) ── */}
      <Modal open={Boolean(offer)} onClose={decline} closable={false}>
        {offer && (
          <div
            style={{
              background: "#18191b",
              color: "#ffffff",
              borderRadius: 20,
              padding: "20px 18px 16px",
              margin: "-16px -16px",
            }}
          >
            {offer.airportReturn && (
              <div className="airport-return-alert" role="status">
                <strong>✈ {offer.airportReturn.title}</strong>
                <p>
                  Arrivée du vol {offer.airportReturn.flightNumber}
                  {offer.airportReturn.city ? ` depuis ${offer.airportReturn.city}` : ""} à{" "}
                  {transportClock(offer.airportReturn.arrivalAt)}.
                </p>
                <p>{offer.airportReturn.statusText}</p>
                <small>{offer.airportReturn.message}</small>
              </div>
            )}
            {/* 1. Ligne du haut : Pilule de gamme à gauche + Croix de refus à droite */}
            <div className="flex items-center justify-between mb-3">
              <div
                style={{
                  background: "#ffffff",
                  color: "#121214",
                  fontWeight: 700,
                  fontSize: "0.92rem",
                  padding: "6px 14px",
                  borderRadius: 9999,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {offer.rideClass === "pet" ? (
                  <PawPrint size={15} />
                ) : offer.rideClass === "xl" ? (
                  <Car size={15} />
                ) : (
                  <User size={15} />
                )}
                <span>{VEHICLE_LABELS[offer.rideClass] || "StrasDrive Go"}</span>
              </div>

              {/* Bouton croix pour refuser d'un clic */}
              <button
                onClick={decline}
                disabled={actionBusy}
                aria-label="Refuser la course"
                style={{
                  background: "#2b2c2f",
                  border: "none",
                  color: "#d1d5db",
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 2. Prix net géant */}
            <div
              style={{
                fontSize: "2.8rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: 10,
                textAlign: "left",
              }}
            >
              {money(offer.profitability?.expectedEarnings ?? offer.earnings)}
            </div>

            {/* 3. Badges chips (Mode de paiement, Note passager, Net chauffeur) */}
            <div className="flex flex-wrap gap-2 mb-4">
              {offer.paymentMethod === "cash" ? (
                <div
                  style={{
                    background: "#2b2c2f",
                    color: "var(--gold-400, #fbbf24)",
                    padding: "5px 12px",
                    borderRadius: 8,
                    fontSize: "0.82rem",
                    fontWeight: 700,
                  }}
                >
                  Espèces ({money(offer.total)})
                </div>
              ) : (
                <div
                  style={{
                    background: "#2b2c2f",
                    color: "#e5e7eb",
                    padding: "5px 12px",
                    borderRadius: 8,
                    fontSize: "0.82rem",
                    fontWeight: 600,
                  }}
                >
                  Portefeuille
                </div>
              )}

              <div
                style={{
                  background: "#2b2c2f",
                  color: "#ffffff",
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Star size={13} fill="#fbbf24" stroke="#fbbf24" />
                <span>5.00</span>
              </div>

              <div
                style={{
                  background: "#2b2c2f",
                  color: "#9ca3af",
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                  fontWeight: 600,
                }}
              >
                Net chauffeur
              </div>
            </div>

            {/* Ligne fine séparatrice */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.1)", marginBottom: 14 }} />

            {/* 4. Itinéraire vertical (Prise en charge + Destination) */}
            <div className="text-left mb-4" style={{ paddingLeft: 4 }}>
              {/* Point de départ */}
              <div className="flex gap-3 items-start relative">
                <div className="flex flex-col items-center" style={{ width: 14 }}>
                  <Circle size={10} strokeWidth={3} style={{ color: "#ffffff", marginTop: 4 }} />
                  <div
                    style={{
                      width: 2,
                      height: 38,
                      background: "rgba(255,255,255,0.25)",
                      margin: "4px 0",
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#ffffff" }}>
                    {offer.etaMinutes} min ({formatDistance(offer.distanceToPickupMeters)})
                  </div>
                  <div className="truncate" style={{ fontSize: "0.82rem", color: "#9ca3af", marginTop: 2 }}>
                    {offer.pickup.address}
                  </div>
                </div>
              </div>

              {/* Point d'arrivée */}
              <div className="flex gap-3 items-start">
                <div className="flex items-center justify-center" style={{ width: 14 }}>
                  <Square size={10} fill="#ffffff" strokeWidth={0} style={{ marginTop: 2 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#ffffff" }}>
                    {formatDistance(offer.distanceMeters)} ({formatDuration(offer.durationSeconds)})
                  </div>
                  <div className="truncate" style={{ fontSize: "0.82rem", color: "#9ca3af", marginTop: 2 }}>
                    {offer.dropoff.address}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Bouton Accepter large avec barre de décompte en arrière-plan */}
            {(() => {
              const maxSec = offer.expiresInSeconds || 15;
              const progressPct = Math.max(0, Math.min(100, (countdown / maxSec) * 100));
              return (
                <button
                  onClick={handleAccept}
                  disabled={actionBusy || countdown === 0}
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: 12,
                    border: "none",
                    position: "relative",
                    overflow: "hidden",
                    fontWeight: 700,
                    fontSize: "1.05rem",
                    cursor: countdown === 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#2b2c2f",
                    color: "#121214",
                  }}
                >
                  {/* Jauge animée qui s'écoule au rythme des secondes */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${progressPct}%`,
                      background: "linear-gradient(90deg, #d1d5db 0%, #e5e7eb 100%)",
                      transition: "width 0.25s linear",
                      zIndex: 1,
                    }}
                  />
                  {/* Texte du bouton */}
                  <span style={{ position: "relative", zIndex: 2 }}>
                    {actionBusy ? (
                      <span className="spinner" />
                    ) : countdown === 0 ? (
                      <span style={{ color: "#9ca3af" }}>Expiré</span>
                    ) : (
                      `Accepter (${countdown}s)`
                    )}
                  </span>
                </button>
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

      {/* ── Cancel trip ── */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Annuler cette course ?">
        <p className="small muted mb-4">
          {" "}
          Un autre chauffeur sera attribué au passager. Des annulations fréquentes réduisent votre priorité
          d’attribution.{" "}
        </p>
        <div className="flex-col gap-2">
          <button
            className="btn btn-danger btn-full"
            disabled={actionBusy}
            onClick={() =>
              run(async () => {
                await cancelTrip("Le chauffeur a annulé");
                setCancelOpen(false);
              }, "Course annulée")
            }
          >
            {actionBusy ? <span className="spinner" /> : "Oui, annuler la course"}
          </button>
          <button className="btn btn-ghost btn-full" onClick={() => setCancelOpen(false)}>
            {" "}
            Conserver la course{" "}
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
