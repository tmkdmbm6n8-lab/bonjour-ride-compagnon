import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import RiderLayout from "@/components/RiderLayout";
import Link from "@/lib/archive-navigation";
import { apiFetch } from "@/lib/archive-fetch";
import { CalendarDays, UserRound, ReceiptText, LifeBuoy, Car } from "lucide-react";
import { RideStatusBadge, Loading, money } from "@/components/ui/bits";
import MapView from "@/components/ArchiveMap";
import { drawableRoute } from "@/lib/utils/route-display";
import Modal from "@/components/ui/Modal";

const ACTIVE = ["searching", "accepted", "arrived", "in_progress"];

function JourneyBanner() {
  return (
    <svg className="activity-banner" viewBox="0 0 1024 134" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="1024" height="134" fill="#e2ecd5" />
      <path d="M0 90Q100-45 250 25T520 20T800 50T1024 0V134H0Z" fill="#8db652" />
      <path d="M0 134Q180 20 360 80T700 15T1024 35V134Z" fill="#08763e" />
      <path d="M440 134Q580 80 550 30L590 30Q640 85 550 134Z" fill="#b7d4d6" />
      <path d="M0 134V85L30 134M90 134V62L120 134M920 134V50L955 134M980 134V35L1010 134" fill="#05532e" />
      <g transform="translate(630 4)">
        <path d="M20 134L36 58Q48 2 85 2H201Q233 4 250 56L274 85L288 134Z" fill="#fff" />
        <path d="M72 10H193Q218 15 234 53H49Q57 20 72 10Z" fill="#13272a" />
        <path d="M93 15H187L220 45H80Z" fill="#62777a" />
        <rect x="40" y="68" width="60" height="30" rx="11" fill="#ff6334" />
        <rect x="219" y="68" width="49" height="30" rx="11" fill="#ff6334" />
        <rect x="126" y="88" width="58" height="23" rx="4" fill="#ffbf40" />
        <path d="M90 60H220V112Q220 124 205 124H108Q90 124 90 110Z" fill="none" stroke="#ccdedf" strokeWidth="2" />
      </g>
    </svg>
  );
}

function RideCard({ ride, onHelp }) {
  const id = ride._id || ride.id;
  const hasCoordinates = Number.isFinite(ride.pickup?.lat) && Number.isFinite(ride.pickup?.lng);
  const date = new Date(ride.createdAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
        date,
      );
  return (
    <article className="activity-ride-card">
      <div className="activity-map" aria-label="Carte du trajet">
        {hasCoordinates ? (
          <MapView
            center={ride.pickup}
            pickup={ride.pickup}
            dropoff={ride.dropoff}
            routeGeometry={drawableRoute(ride.route?.geometry)}
            fit
          />
        ) : (
          <Car size={46} />
        )}
      </div>
      <div className="activity-ride-info">
        <Link href={`/rides/${id}`} className="activity-destination">
          {ride.dropoff?.address || "Course StrasDrive"}
        </Link>
        <p>{dateLabel}</p>
        <p>
          {ride.status === "completed"
            ? money(ride.fare?.total)
            : ride.status === "cancelled"
              ? money(ride.fare?.cancellationFee || 0)
              : money(ride.fare?.total || 0)}
        </p>
        {ride.status !== "completed" && (
          <div className="activity-status">
            <RideStatusBadge status={ride.status} />
          </div>
        )}
        <div className="activity-card-actions">
          <button className="activity-pill" onClick={() => onHelp(ride)}>
            <LifeBuoy size={13} />
            Aide
          </button>
          <Link className="activity-pill" href={`/rides/${id}`}>
            <ReceiptText size={13} />
            Détails
          </Link>
        </div>
      </div>
    </article>
  );
}

function RidesPage() {
  const [rides, setRides] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [activeLoading, setActiveLoading] = useState(true);
  const [activeError, setActiveError] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [helpRide, setHelpRide] = useState(null);

  useEffect(() => {
    let ignore = false;
    setActiveLoading(true);
    setActiveError(false);
    apiFetch("/api/rides/active")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!ignore) setActiveRide(data.ride || null);
      })
      .catch(() => {
        if (!ignore) setActiveError(true);
      })
      .finally(() => {
        if (!ignore) setActiveLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [retry]);

  useEffect(() => {
    let ignore = false;
    setRides(null);
    setError(false);
    (async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: "15" });
        if (filter) params.set("status", filter);
        const res = await apiFetch(`/api/rides?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!ignore) {
          setRides(data.rides || []);
          setPagination(data.pagination);
        }
      } catch {
        if (!ignore) {
          setError(true);
          setRides([]);
          setPagination(null);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [filter, page, retry]);

  const pastRides = rides?.filter((ride) => !ACTIVE.includes(ride.status));
  return (
    <div className="activity-page">
      <aside className="activity-side">
        <Link href="/profile">Mon profil</Link>
      </aside>
      <div className="activity-main">
        <section aria-labelledby="activity-upcoming-title">
          <h1 id="activity-upcoming-title">À venir</h1>
          {activeLoading ? (
            <Loading label="Chargement de votre course…" />
          ) : activeError ? (
            <div className="activity-empty">
              <p>Impossible de charger votre course en cours.</p>
              <button className="activity-pill" onClick={() => setRetry((n) => n + 1)}>
                Réessayer
              </button>
            </div>
          ) : activeRide ? (
            <RideCard ride={activeRide} onHelp={setHelpRide} />
          ) : (
            <div className="activity-upcoming-card">
              <JourneyBanner />
              <div className="activity-upcoming-body">
                <h2>Vous n’avez aucune course à venir</h2>
                <Link href="/dashboard" className="activity-pill">
                  <Car size={15} />
                  Réserver un trajet
                </Link>
              </div>
            </div>
          )}
        </section>
        <section className="activity-past" aria-labelledby="activity-past-title">
          <div className="activity-section-heading">
            <h2 id="activity-past-title">Passées</h2>
            <div className="activity-filters">
              <span className="activity-pill">
                <UserRound size={15} />
                Personnel
              </span>
              <label className="activity-pill">
                <CalendarDays size={15} />
                <select
                  value={filter}
                  aria-label="Filtrer les courses"
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Toutes les courses</option>
                  <option value="completed">Courses effectuées</option>
                  <option value="cancelled">Courses annulées</option>
                </select>
              </label>
            </div>
          </div>
          {rides === null && <Loading label="Chargement de vos courses…" />}
          {error && (
            <div role="alert" className="activity-empty">
              <p>Impossible de charger votre activité.</p>
              <button className="activity-pill" onClick={() => setRetry((n) => n + 1)}>
                Réessayer
              </button>
            </div>
          )}
          {!error && pastRides?.length === 0 && (
            <div className="activity-empty">
              <Car size={32} />
              <h3>Aucune course passée</h3>
              <p>Vos courses apparaîtront ici après votre trajet.</p>
            </div>
          )}
          <div className="activity-list">
            {pastRides?.map((ride) => (
              <RideCard key={ride._id || ride.id} ride={ride} onHelp={setHelpRide} />
            ))}
          </div>
          {pagination?.pages > 1 && (
            <div className="activity-pagination">
              <button className="activity-pill" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Précédent
              </button>
              <span>
                {page} / {pagination.pages}
              </span>
              <button
                className="activity-pill"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </button>
            </div>
          )}
        </section>
      </div>
      <Modal open={!!helpRide} onClose={() => setHelpRide(null)} title="Aide sur votre course">
        <p>Les informations du trajet, du tarif et du chauffeur sont disponibles dans le détail de la course.</p>
        {helpRide && (
          <Link
            className="btn btn-secondary mt-4"
            href={`/rides/${helpRide._id || helpRide.id}`}
            onClick={() => setHelpRide(null)}
          >
            Consulter les détails de la course
          </Link>
        )}
      </Modal>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/rides")({
  head: () => ({
    meta: [
      { title: "Activité · StrasDrive" },
      { name: "description", content: "Retrouvez vos courses et les détails de vos trajets StrasDrive." },
    ],
  }),
  component: () => (
    <RiderLayout>
      <RidesPage />
    </RiderLayout>
  ),
});
