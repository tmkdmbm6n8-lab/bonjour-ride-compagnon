import { parisFormInstant, parisFormValue, nextWeeklyDeparture } from '@/lib/scheduled-pricing';
import { useEffect, useRef, useState } from "react";
import { 
  Plane, TrainFront, RefreshCw, Clock, MapPin, Car, LocateFixed, 
  CalendarDays, Flag, ChevronDown, ChevronUp, CalendarClock, Repeat2, CheckCircle2 
} from "lucide-react";
import RiderLayout from "@/components/RiderLayout";
import Modal from "@/components/ui/Modal";
import PlaceSearch from "@/components/maps/PlaceSearch";
import { Loading, money, VEHICLE_LABELS } from "@/components/ui/bits";
import useDriverData from "@/hooks/useDriverData";
import { apiFetch } from "@/lib/archive-fetch";
import { clock, parisDay } from "@/lib/vtc-dates";
import { AIRPORT, STATION } from "@/lib/vtc-transport";

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default function PassengerTraffic() {
  // Accordéon Vols / Trains
  const [openAccordion, setOpenAccordion] = useState(null); // 'flight' | 'train' | null
  const [direction, setDirection] = useState("arrival"); // 'arrival' | 'departure'

  // Formulaire de réservation (partagé vol/train et saisie manuelle)
  const [bookingType, setBookingType] = useState("onetime"); // 'onetime' | 'recurring'
  const [selectedTransport, setSelectedTransport] = useState(null);

  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [pickupText, setPickupText] = useState("");
  const [dropoffText, setDropoffText] = useState("");

  const [scheduledAt, setScheduledAt] = useState("");
  const [recurringWeekday, setRecurringWeekday] = useState("1"); // Lundi
  const [recurringTime, setRecurringTime] = useState("08:00");

  const [vehicleType, setVehicleType] = useState("economy");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [estimates, setEstimates] = useState(null);
  const [estimating, setEstimating] = useState(false);

  // Gestion des réservations existantes
  const [showMyReservations, setShowMyReservations] = useState(false);
  const [scheduledRequests, setScheduledRequests] = useState([]);
  const [reservationLoading, setReservationLoading] = useState(true);
  const [reservationError, setReservationError] = useState("");

  // États de soumission et modification
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [locating, setLocating] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");

  const formRef = useRef(null);
  const { data, error, reload } = useDriverData("/api/riders/me/transport-board?day=" + parisDay());

  // Chargement des réservations du passager
  useEffect(() => {
    let active = true;
    async function loadReservations() {
      try {
        const response = await apiFetch("/api/riders/me/scheduled-requests");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Chargement impossible");
        if (active) {
          setScheduledRequests((result.requests || []).filter(item => item.status !== "canceled"));
          setReservationError("");
        }
      } catch (e) {
        if (active) setReservationError(e.message);
      } finally {
        if (active) setReservationLoading(false);
      }
    }
    loadReservations();
    const timer = setInterval(loadReservations, 20000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  // Estimation du prix dès que départ et destination sont définis
  useEffect(() => {
    if (!Number.isFinite(pickup?.lat) || !Number.isFinite(pickup?.lng) ||
        !Number.isFinite(dropoff?.lat) || !Number.isFinite(dropoff?.lng)) {
      setEstimates(null);
      setEstimating(false);
      return;
    }
    const departureAt = bookingType === 'recurring'
      ? nextWeeklyDeparture(Number(recurringWeekday),recurringTime)
      : parisFormInstant(scheduledAt);
    if (!departureAt) { setEstimates(null); setEstimating(false); return; }
    let cancelled = false;
    setEstimates(null);
    setEstimating(true);
    (async () => {
      try {
        const res = await apiFetch("/api/rides/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickup: { lat: pickup.lat, lng: pickup.lng },
            dropoff: { lat: dropoff.lat, lng: dropoff.lng },
            scheduledAt: departureAt
          })
        });
        const d = await res.json();
        if (!cancelled && res.ok && d?.estimates) setEstimates(d.estimates);
      } catch {
        /* estimation facultative */
      } finally {
        if (!cancelled) setEstimating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, scheduledAt, bookingType, recurringWeekday, recurringTime]);

  // Clic sur un Vol ou un Train : Remplissage intelligent automatique
  function selectTransportItem(item) {
    const hub = item.kind === "flight" ? AIRPORT : STATION;
    setSelectedTransport(item);
    setBookingType("onetime");
    setErrorMessage("");
    setSuccess("");

    const targetDate = new Date(item.estimated || item.scheduled);

    if (item.direction === "arrival") {
      // Arrivée : Départ = Hub. Prise en charge intelligente = Heure d'arrivée + 20 min (sortie / bagages)
      const pickupTime = new Date(targetDate.getTime() + 20 * 60000);
      setPickup({ ...hub, address: hub.name });
      setPickupText(hub.name);
      setScheduledAt(parisFormValue(pickupTime));
    } else {
      // Départ : Arrivée = Hub. Prise en charge intelligente = 1h45 avant vol ou 40 min avant train
      const marginMinutes = item.kind === "flight" ? 105 : 40;
      const pickupTime = new Date(targetDate.getTime() - marginMinutes * 60000);
      setDropoff({ ...hub, address: hub.name });
      setDropoffText(hub.name);
      setScheduledAt(parisFormValue(pickupTime));
    }

    // Scroll doux vers le formulaire pour finaliser
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }

  // Localisation GPS pour l'adresse de départ
  async function locatePickup() {
    if (!navigator.geolocation) {
      setErrorMessage("La géolocalisation n'est pas supportée par votre appareil.");
      return;
    }
    setLocating(true);
    setErrorMessage("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address = "Position actuelle";
        try {
          const res = await apiFetch(`/api/geo/search?reverse=1&lat=${lat}&lng=${lng}`);
          const d = await res.json();
          address = d.results?.[0]?.address || address;
        } catch { /* conserve le libellé de secours */ }
        setPickup({ lat, lng, address });
        setPickupText(address);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setErrorMessage("Impossible d'obtenir votre position.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Enregistrement de la réservation (ponctuelle ou récurrente)
  async function handleBook(e) {
    e.preventDefault();
    if (!pickup?.address || !dropoff?.address || busy) {
      setErrorMessage("Veuillez renseigner les adresses de départ et de destination.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    setSuccess("");

    try {
      let payload;
      const estimatedPrice = Number.isFinite(Number(estimates?.[vehicleType]?.total)) && estimates?.[vehicleType]?.total != null
        ? Number(estimates[vehicleType].total)
        : null;

      if (bookingType === "recurring") {
        payload = {
          kind: "recurring",
          pickupAddress: pickup.address,
          dropoffAddress: dropoff.address,
          weekday: Number(recurringWeekday),
          localTime: recurringTime,
          paymentMethod,
          estimatedPrice
        };
      } else {
        const when = new Date(parisFormInstant(scheduledAt) || NaN);
        if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) {
          throw new Error("Veuillez sélectionner une date et heure de départ future.");
        }
        payload = {
          kind: "transport",
          pickupAddress: pickup.address,
          dropoffAddress: dropoff.address,
          transportType: selectedTransport?.kind || "flight",
          transportNumber: selectedTransport?.number || "RESERVATION",
          scheduledAt: when.toISOString(),
          paymentMethod,
          estimatedPrice
        };
      }

      payload = {...payload,vehicleType,pickup,dropoff};
      const response = await apiFetch("/api/riders/me/scheduled-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'enregistrer la réservation.");

      setScheduledRequests(current => [result.request, ...current]);
      setSuccess("Votre réservation a été enregistrée avec succès !");
      setSelectedTransport(null);

      // Réinitialiser les champs spécifiques
      setPickup(null);
      setPickupText("");
      setDropoff(null);
      setDropoffText("");
      setScheduledAt("");
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Modification d'une réservation
  function openEdit(req) {
    const at = new Date(req.scheduled_at);
    setEditError("");
    setEditing({
      id: req.id,
      pickupAddress: req.pickup_address,
      dropoffAddress: req.dropoff_address,
      paymentMethod: req.payment_method || "cash",
      estimatedPrice: req.estimated_price,
      vehicleType: "",
      scheduledAt: Number.isFinite(at.getTime())
        ? parisFormValue(at)
        : ""
    });
  }

  async function saveEdit() {
    if (!editing || editBusy) return;
    const when = new Date(parisFormInstant(editing.scheduledAt) || NaN);
    if (!editing.vehicleType) { setEditError("Sélectionnez la catégorie pour recalculer le prix."); return; }
    if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) {
      setEditError("Choisissez une date et une heure futures.");
      return;
    }
    setEditBusy(true);
    setEditError("");
    try {
      const response = await apiFetch("/api/riders/me/scheduled-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editing, scheduledAt: when.toISOString() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Modification impossible");
      setScheduledRequests(current => current.map(item => item.id === result.request.id ? result.request : item));
      setEditing(null);
      setSuccess("Réservation modifiée. Elle sera confirmée par votre chauffeur.");
    } catch (e) {
      setEditError(e.message);
    } finally {
      setEditBusy(false);
    }
  }

  // Annulation d'une réservation
  async function cancelScheduled(id) {
    if (!window.confirm("Voulez-vous vraiment annuler cette réservation ?")) return;
    try {
      const response = await apiFetch("/api/riders/me/scheduled-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Annulation impossible");
      setScheduledRequests(current => current.filter(item => item.id !== id));
      setSuccess("Réservation annulée.");
    } catch (e) {
      setErrorMessage(e.message);
    }
  }

  // Filtrage des vols et trains pour l'accordéon
  const flightItems = (data?.items || []).filter(item => item.kind === "flight" && item.direction === direction && item.status !== "completed" && item.status !== "cancelled");
  const trainItems = (data?.items || []).filter(item => item.kind === "train" && item.direction === direction && item.status !== "completed" && item.status !== "cancelled");

  return (
    <RiderLayout>
      <div className="driver-tab-page discover-page drv-cockpit-page" style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 60 }}>
        
        {/* Titre & Rafraîchissement */}
        <div className="driver-tab-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, fontWeight: 700 }}>
            <CalendarClock size={26} color="#e9bd50" />
            Réservation
          </h1>
          <button className="driver-icon-button" onClick={reload} aria-label="Actualiser">
            <RefreshCw size={20} />
          </button>
        </div>

        {/* Bouton vers mes réservations */}
        <button
          type="button"
          className="drv-traffic-tab"
          onClick={() => setShowMyReservations(v => !v)}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 9,
            marginBottom: 20,
            padding: "12px 16px",
            background: showMyReservations ? "rgba(233,189,80,0.15)" : "var(--drv-surface)",
            border: showMyReservations ? "1px solid #e9bd50" : "1px solid var(--drv-line)",
            color: showMyReservations ? "#e9bd50" : "#fff",
            borderRadius: 14,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          <CalendarDays size={18} />
          Mes réservations {scheduledRequests.length > 0 ? `(${scheduledRequests.length})` : ""}
        </button>

        {/* Affichage des réservations en cours */}
        {showMyReservations && (
          <section style={{ display: "grid", gap: 12, marginBottom: 28 }}>
            {reservationLoading && <p className="small muted">Chargement des réservations…</p>}
            {reservationError && <p role="alert" style={{ color: "crimson" }}>{reservationError}</p>}
            {!reservationLoading && !scheduledRequests.length && (
              <p className="driver-empty-state" style={{ textAlign: "center", padding: 24, background: "var(--drv-surface)", borderRadius: 14 }}>
                Aucune réservation enregistrée pour le moment.
              </p>
            )}
            {scheduledRequests.map(req => (
              <article key={req.id} style={{ padding: 18, border: "1px solid rgba(212,160,23,.3)", background: "var(--drv-surface)", color: "#fff", borderRadius: 16 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#facc15", fontWeight: 700 }}>
                  {req.kind === "recurring" ? <Repeat2 size={19} /> : req.transport_type === "flight" ? <Plane size={19} /> : <TrainFront size={19} />}
                  <span>{req.kind === "recurring" ? "Trajet Récurrent" : `Réservation ${req.transport_number || ""}`}</span>
                  {req.estimated_price != null && (
                    <span style={{ marginLeft: "auto", color: "#39ff88", fontWeight: 700 }}>{money(req.estimated_price)}</span>
                  )}
                </div>

                <p style={{ fontWeight: 600, margin: "10px 0 14px", color: "var(--drv-text-2)" }}>
                  {req.kind === "recurring"
                    ? `Tous les ${DAYS[req.weekday]}s à ${req.local_time}`
                    : new Date(req.scheduled_at).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}
                </p>

                <p style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14 }}>
                  <MapPin size={17} color="#39ff88" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{req.pickup_address}</span>
                </p>
                <p style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 6, fontSize: 14 }}>
                  <Flag size={17} color="#ff657c" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{req.dropoff_address}</span>
                </p>

                <p style={{ fontSize: 13, color: req.status === "confirmed" ? "#39ff88" : req.status === "modified_pending" ? "#eab308" : "#e9bd50", margin: "14px 0 10px" }}>
                  {req.status === "confirmed" ? "✓ Chauffeur confirmé" : req.status === "modified_pending" ? "⚠️ Modification en attente" : "⏳ En attente d'un chauffeur"}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button className="btn btn-secondary" style={{ padding: "8px 12px", fontSize: 13 }} type="button" onClick={() => openEdit(req)}>
                    Modifier
                  </button>
                  <button className="btn btn-secondary" style={{ padding: "8px 12px", fontSize: 13, borderColor: "#ef4444", color: "#f87171" }} type="button" onClick={() => cancelScheduled(req.id)}>
                    Annuler
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* ── BANNIÈRE D'ACCROCHE ── */}
        <div style={{
          padding: "16px 20px",
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(233,189,80,0.12) 0%, rgba(20,24,33,0.85) 100%)",
          border: "1px solid rgba(233,189,80,0.25)",
          marginBottom: 20
        }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e9bd50", lineHeight: 1.4 }}>
            ✈️ Vous avez un vol ou un train à prendre ?
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--drv-text-2)", lineHeight: 1.4 }}>
            Réservez en un clic sur votre trajet ci-dessous : les adresses et horaires s'adaptent automatiquement.
          </p>
        </div>

        {/* ── SECTION DÉROULANTE : VOLS & TRAINS (ACCORDÉON) ── */}
        <div style={{ display: "grid", gap: 10, marginBottom: 26 }}>
          
          {/* Onglet Déroulant 1 : VOLS */}
          <div style={{ borderRadius: 14, border: "1px solid var(--drv-line)", background: "var(--drv-surface)", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setOpenAccordion(current => current === "flight" ? null : "flight")}
              style={{
                width: "100%",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: openAccordion === "flight" ? "var(--drv-surface-2)" : "transparent",
                border: 0,
                color: "#fff",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer"
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Plane size={20} color="#e9bd50" />
                Vols · Aéroport d'Entzheim
              </span>
              {openAccordion === "flight" ? <ChevronUp size={20} color="#e9bd50" /> : <ChevronDown size={20} color="var(--drv-text-3)" />}
            </button>

            {openAccordion === "flight" && (
              <div style={{ padding: "14px 16px", borderTop: "1px solid var(--drv-line)" }}>
                {/* Sélecteur Arrivées / Départs */}
                <div className="drv-direction-segmented" style={{ marginBottom: 12 }}>
                  <button className={"drv-direction-btn " + (direction === "arrival" ? "active" : "")} onClick={() => setDirection("arrival")}>
                    Arrivées (Je viens de l'aéroport)
                  </button>
                  <button className={"drv-direction-btn " + (direction === "departure" ? "active" : "")} onClick={() => setDirection("departure")}>
                    Départs (Je vais à l'aéroport)
                  </button>
                </div>

                {!data && !error && <Loading label="Chargement des vols…" />}
                {data && !flightItems.length && (
                  <p className="driver-empty-state" style={{ margin: "10px 0" }}>Aucun vol répertorié pour le moment.</p>
                )}

                <div className="discover-events" style={{ display: "grid", gap: 8 }}>
                  {flightItems.map(item => (
                    <article key={item.id} className="drv-traffic-card" style={{ cursor: "pointer", border: selectedTransport?.id === item.id ? "1px solid #e9bd50" : undefined }}>
                      <button className="drv-traffic-main" type="button" onClick={() => selectTransportItem(item)}>
                        <div className="drv-traffic-icon-box"><Plane size={20} /></div>
                        <div className="drv-traffic-info">
                          <div className="drv-traffic-header-line">
                            <span className="drv-traffic-time">
                              {clock(item.scheduled)}
                              {item.estimated && item.estimated !== item.scheduled ? <span className="drv-traffic-delay"> → {clock(item.estimated)}</span> : null}
                            </span>
                            <span className={"transport-status " + (item.status === "delayed" ? "delayed" : "")}>{item.statusText}</span>
                          </div>
                          <h3>{item.number} · {item.city || "Strasbourg"}</h3>
                          <p className="drv-traffic-sub">{item.carrier} {item.terminal ? `· Terminal ${item.terminal}` : ""}</p>
                        </div>
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Onglet Déroulant 2 : TRAINS */}
          <div style={{ borderRadius: 14, border: "1px solid var(--drv-line)", background: "var(--drv-surface)", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setOpenAccordion(current => current === "train" ? null : "train")}
              style={{
                width: "100%",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: openAccordion === "train" ? "var(--drv-surface-2)" : "transparent",
                border: 0,
                color: "#fff",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer"
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <TrainFront size={20} color="#e9bd50" />
                Trains · Gare Centrale
              </span>
              {openAccordion === "train" ? <ChevronUp size={20} color="#e9bd50" /> : <ChevronDown size={20} color="var(--drv-text-3)" />}
            </button>

            {openAccordion === "train" && (
              <div style={{ padding: "14px 16px", borderTop: "1px solid var(--drv-line)" }}>
                {/* Sélecteur Arrivées / Départs */}
                <div className="drv-direction-segmented" style={{ marginBottom: 12 }}>
                  <button className={"drv-direction-btn " + (direction === "arrival" ? "active" : "")} onClick={() => setDirection("arrival")}>
                    Arrivées (Je sors du train)
                  </button>
                  <button className={"drv-direction-btn " + (direction === "departure" ? "active" : "")} onClick={() => setDirection("departure")}>
                    Départs (Je vais prendre le train)
                  </button>
                </div>

                {!data && !error && <Loading label="Chargement des trains…" />}
                {data && !trainItems.length && (
                  <p className="driver-empty-state" style={{ margin: "10px 0" }}>Aucun train répertorié pour le moment.</p>
                )}

                <div className="discover-events" style={{ display: "grid", gap: 8 }}>
                  {trainItems.map(item => (
                    <article key={item.id} className="drv-traffic-card" style={{ cursor: "pointer", border: selectedTransport?.id === item.id ? "1px solid #e9bd50" : undefined }}>
                      <button className="drv-traffic-main" type="button" onClick={() => selectTransportItem(item)}>
                        <div className="drv-traffic-icon-box"><TrainFront size={20} /></div>
                        <div className="drv-traffic-info">
                          <div className="drv-traffic-header-line">
                            <span className="drv-traffic-time">
                              {clock(item.scheduled)}
                              {item.estimated && item.estimated !== item.scheduled ? <span className="drv-traffic-delay"> → {clock(item.estimated)}</span> : null}
                            </span>
                            <span className={"transport-status " + (item.status === "delayed" ? "delayed" : "")}>{item.statusText}</span>
                          </div>
                          <h3>{item.number} · {item.city || "Strasbourg"}</h3>
                          <p className="drv-traffic-sub">{item.carrier} {item.platform ? `· Voie ${item.platform}` : ""}</p>
                        </div>
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── INTERFACE DE RÉSERVATION ÉPURÉE & HARMONIEUSE ── */}
        <section
          ref={formRef}
          style={{
            background: "var(--drv-surface)",
            border: "1px solid var(--drv-line)",
            borderRadius: 20,
            padding: "22px 20px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#fff" }}>
              {selectedTransport ? `Trajet associé : ${selectedTransport.number}` : "Réserver votre course"}
            </h2>
            {selectedTransport && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: "4px 8px" }}
                onClick={() => setSelectedTransport(null)}
              >
                Réinitialiser
              </button>
            )}
          </div>

          {/* Sélecteur de mode : Course ponctuelle vs Récurrente */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
            <button
              type="button"
              className={"btn " + (bookingType === "onetime" ? "btn-primary" : "btn-secondary")}
              style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: 10, fontSize: 14 }}
              onClick={() => setBookingType("onetime")}
            >
              <CalendarClock size={16} /> Course ponctuelle
            </button>
            <button
              type="button"
              className={"btn " + (bookingType === "recurring" ? "btn-primary" : "btn-secondary")}
              style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: 10, fontSize: 14 }}
              onClick={() => { setBookingType("recurring"); setSelectedTransport(null); }}
            >
              <Repeat2 size={16} /> Trajet récurrent
            </button>
          </div>

          <form onSubmit={handleBook} style={{ display: "grid", gap: 16 }}>
            
            {/* Adresse de départ */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--drv-text-2)" }}>Lieu de départ</label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "4px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                  onClick={locatePickup}
                  disabled={locating}
                >
                  <LocateFixed size={14} />
                  {locating ? "Localisation…" : "Ma position"}
                </button>
              </div>
              <PlaceSearch
                value={pickupText}
                onChangeText={t => { setPickupText(t); setPickup(null); }}
                onSelect={point => { setPickup(point); setPickupText(point.address); }}
                committedValue={pickup?.address}
                placeholder="Ex : 12 rue du Dôme, Strasbourg"
                icon={MapPin}
              />
            </div>

            {/* Adresse d'arrivée */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--drv-text-2)", marginBottom: 6 }}>
                Lieu de destination
              </label>
              <PlaceSearch
                value={dropoffText}
                onChangeText={t => { setDropoffText(t); setDropoff(null); }}
                onSelect={point => { setDropoff(point); setDropoffText(point.address); }}
                committedValue={dropoff?.address}
                placeholder="Ex : Gare Centrale ou Aéroport"
                icon={Flag}
              />
            </div>

            {/* Date & Heure pour course ponctuelle */}
            {bookingType === "onetime" && (
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--drv-text-2)", marginBottom: 6 }}>
                  Date et heure de départ souhaitées
                </label>
                <input
                  className="input"
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  style={{ width: "100%", padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--drv-line)", color: "#fff" }}
                />
              </div>
            )}

            {/* Jour & Heure pour trajet récurrent */}
            {bookingType === "recurring" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--drv-text-2)", marginBottom: 6 }}>
                    Chaque semaine le
                  </label>
                  <select
                    className="input"
                    value={recurringWeekday}
                    onChange={e => setRecurringWeekday(e.target.value)}
                    style={{ width: "100%", padding: 12, borderRadius: 10, background: "var(--drv-surface-2)", border: "1px solid var(--drv-line)", color: "#fff" }}
                  >
                    {DAYS.map((day, idx) => (
                      <option key={day} value={idx}>{day}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--drv-text-2)", marginBottom: 6 }}>
                    À l'heure
                  </label>
                  <input
                    className="input"
                    type="time"
                    required
                    value={recurringTime}
                    onChange={e => setRecurringTime(e.target.value)}
                    style={{ width: "100%", padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--drv-line)", color: "#fff" }}
                  />
                </div>
              </div>
            )}

            {/* Catégorie de véhicule avec tarif en direct */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--drv-text-2)" }}>Catégorie de véhicule</label>
                {Number.isFinite(Number(estimates?.economy?.total)) && (
                  <span style={{ fontSize: 13, color: "#39ff88", fontWeight: 700 }}>
                    À partir de {money(estimates.economy.total)}
                  </span>
                )}
              </div>
              <select
                className="input"
                style={{ width: "100%", padding: 12, borderRadius: 10, background: "var(--drv-surface-2)", border: "1px solid var(--drv-line)", color: "#fff", fontWeight: 500 }}
                value={vehicleType}
                onChange={e => setVehicleType(e.target.value)}
              >
                <option value="economy">
                  StrasDrive Go {Number.isFinite(Number(estimates?.economy?.total)) ? `· ${money(estimates.economy.total)}` : ""}
                </option>
                <option value="comfort">
                  StrasDrive Confort {Number.isFinite(Number(estimates?.comfort?.total)) ? `· ${money(estimates.comfort.total)}` : ""}
                </option>
                <option value="xl">
                  StrasDrive XL {Number.isFinite(Number(estimates?.xl?.total)) ? `· ${money(estimates.xl.total)}` : ""}
                </option>
                <option value="pet">
                  StrasDrive Pet {Number.isFinite(Number(estimates?.pet?.total)) ? `· ${money(estimates.pet.total)}` : ""}
                </option>
              </select>
              {estimating && <p className="small muted" style={{ marginTop: 4 }}>Calcul du tarif en cours…</p>}
              {!estimating && (!pickup || !dropoff) && (
                <p className="small muted" style={{ marginTop: 4 }}>Indiquez le départ et l'arrivée pour voir le tarif exact.</p>
              )}
            </div>

            {/* Mode de paiement */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--drv-text-2)", marginBottom: 6 }}>
                Mode de paiement
              </label>
              <select
                className="input"
                style={{ width: "100%", padding: 12, borderRadius: 10, background: "var(--drv-surface-2)", border: "1px solid var(--drv-line)", color: "#fff" }}
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
              >
                <option value="cash">Espèces au chauffeur</option>
                <option value="wallet">Portefeuille StrasDrive</option>
                <option value="card">Carte bancaire</option>
              </select>
            </div>

            {errorMessage && (
              <p role="alert" style={{ color: "#ef4444", fontSize: 13, background: "rgba(239,68,68,0.1)", padding: 10, borderRadius: 8, margin: 0 }}>
                {errorMessage}
              </p>
            )}

            {success && (
              <p role="status" style={{ color: "#39ff88", fontSize: 13, background: "rgba(57,255,136,0.1)", padding: 10, borderRadius: 8, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle2 size={16} />
                {success}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!pickup || !dropoff || busy}
              style={{ width: "100%", padding: 14, fontSize: 15, fontWeight: 700, borderRadius: 12, marginTop: 6 }}
            >
              {busy ? "Enregistrement…" : "Enregistrer ma réservation"}
            </button>
          </form>
        </section>

        {/* Modal de modification d'une réservation */}
        <Modal portal keyboardSafe open={Boolean(editing)} onClose={() => { if (!editBusy) setEditing(null); }} title="Modifier la réservation" maxWidth={560}>
          {editing && (
            <div style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                Départ
                <input className="input" value={editing.pickupAddress} onChange={e => setEditing(v => ({ ...v, pickupAddress: e.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                Destination
                <input className="input" value={editing.dropoffAddress} onChange={e => setEditing(v => ({ ...v, dropoffAddress: e.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                Catégorie pour le nouveau devis
                <select className="input" value={editing.vehicleType} onChange={e => setEditing(v => ({...v,vehicleType:e.target.value}))}>
                  <option value="">Sélectionner la catégorie</option>
                  {Object.entries(VEHICLE_LABELS).filter(([key])=>['economy','comfort','pet','xl'].includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                Date et heure de prise en charge (heure de Paris)
                <input className="input" type="datetime-local" value={editing.scheduledAt} onChange={e => setEditing(v => ({ ...v, scheduledAt: e.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                Paiement
                <select className="input" value={editing.paymentMethod} onChange={e => setEditing(v => ({ ...v, paymentMethod: e.target.value }))}>
                  <option value="cash">Espèces</option>
                  <option value="wallet">Portefeuille</option>
                  <option value="card">Carte bancaire</option>
                </select>
              </label>
              <p className="small muted">Après modification, la course devra être de nouveau confirmée par un chauffeur.</p>
              {editError && <p role="alert" style={{ color: "crimson" }}>{editError}</p>}
              <button type="button" className="btn btn-primary" disabled={editBusy} onClick={saveEdit}>
                {editBusy ? "Enregistrement…" : "Enregistrer les modifications"}
              </button>
            </div>
          )}
        </Modal>

      </div>
    </RiderLayout>
  );
}
