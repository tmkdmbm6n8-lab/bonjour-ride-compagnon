import PickupWaitingTimer from "@/components/ride/PickupWaitingTimer";
import CloseControl from "@/components/ui/CloseControl";
import { ShieldAlert } from "lucide-react";
import RidePauseButton from "@/components/driver/RidePauseButton";
import FinishRideButton from "@/components/driver/FinishRideButton";
import RideSafety from "@/components/ride/RideSafety";
import { createFileRoute } from "@tanstack/react-router";
import DriverLayout from "@/components/DriverLayout";
import { apiFetch as fetch } from "@/lib/archive-fetch";
("use client");

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/lib/archive-navigation";
import {
  Navigation,
  Radar,
  MessageCircle,
  X,
  KeyRound,
  Flag,
  Phone,
  FileText,
  ChevronUp,
  ChevronDown,
  CreditCard,
  Banknote,
} from "lucide-react";
import useGeolocation from "@/hooks/useGeolocation";

import MapView from "@/components/ArchiveMap";
import ChatSheet from "@/components/ride/ChatSheet";
import MessageAlert from "@/components/ride/MessageAlert";
import { whenChatMessageReady } from "@/lib/chat-media-cache";
import Waybill from "@/components/driver/Waybill";
import DriverHome from "@/components/driver/DriverHome";
import PassengerInfo from "@/components/driver/PassengerInfo";
import { pickupZoneProblem, ARRIVAL_ZONE_METERS } from "@/lib/vtc-dispatch";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { money, VEHICLE_LABELS } from "@/components/ui/bits";
import { useDriverActivity } from "@/context/DriverActivityProvider";
import { formatDistance, formatDuration, roadDistanceMeters, etaMinutes as etaFor } from "@/lib/utils/geo";
import { playSound } from "@/lib/sounds";
import ExternalNavigationButton from "@/components/driver/ExternalNavigationButton";
import { useLiveRoute } from "@/hooks/useLiveRoute";
import useRouteRadars from "@/hooks/useRouteRadars";
import { routeQualityLabel } from "@/lib/vtc-routing";
import { drawableRoute, arrivalClock } from "@/lib/utils/route-display";

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
  const [unread, setUnread] = useState(0);
  const [lastMsg, setLastMsg] = useState(null);
  const chatOpenRef = useRef(false);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  const onEvent = useCallback(
    (type, data) => {
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
    arrive,
    start,
    complete,
    cancelTrip,
  } = useDriverActivity({ onEvent });

  // Availability and incoming offers are owned by the persistent app provider.
  const { position: idlePosition } = useGeolocation({ watch: false });

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
    if (position) {
      const problem = pickupZoneProblem(position, ride.pickup, ARRIVAL_ZONE_METERS);
      if (problem) {
        setArrivalNotice(problem);
        return;
      }
    }
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
      {profile?.isReportSuspended && !ride ? (
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
                  {ride.payment?.method === "cash" ? (
                    <span className="drv-payment-icon drv-payment-icon--cash" role="img" aria-label="Paiement en espèces" title="Espèces"><Banknote size={20} aria-hidden="true" /></span>
                  ) : (
                    <span className="drv-payment-icon drv-payment-icon--card" role="img" aria-label="Paiement par carte" title="Carte bancaire"><CreditCard size={20} aria-hidden="true" /></span>
                  )}
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
                  <div className="flex justify-between items-center mb-2 text-sm text-muted">
                    <span>Mode de règlement :</span>
                    {ride.payment?.method === "cash" ? (
                      <span className="drv-payment-icon drv-payment-icon--cash" role="img" aria-label="Paiement en espèces" title="Espèces"><Banknote size={20} aria-hidden="true" /></span>
                    ) : (
                      <span className="drv-payment-icon drv-payment-icon--card" role="img" aria-label="Paiement par carte" title="Carte bancaire"><CreditCard size={20} aria-hidden="true" /></span>
                    )}
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
                  <PickupWaitingTimer arrivedAt={ride.arrived_at} rate={ride.fare?.pickupWaitingRate} />
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
            waiting={!offer}
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
