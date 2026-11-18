import DriverRatings from '@/components/driver/DriverRatings';
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Circle, MapPin } from "lucide-react";
import DriverLayout from "@/components/DriverLayout";
import Link from "@/lib/archive-navigation";
import PayoutCard from "@/components/driver/PayoutCard";
import { Loading, money, RideStatusBadge } from "@/components/ui/bits";
import useDriverData from "@/hooks/useDriverData";
import { parisDay, shiftDay, workDuration } from "@/lib/vtc-dates";
function EarningsPage() {
  const [day, setDay] = useState(parisDay()),
    [selectedDay, setSelectedDay] = useState(parisDay()),
    [ratingsOpen, setRatingsOpen] = useState(false);
  useEffect(() => {
    const today = parisDay();
    setDay(today); setSelectedDay(today);
    let observedDay = today;
    const checkDay = () => {
      const currentDay = parisDay();
      if (currentDay !== observedDay) { observedDay = currentDay; setDay(currentDay); setSelectedDay(currentDay); }
    };
    const timer = setInterval(checkDay, 60000);
    window.addEventListener('focus', checkDay);
    return () => { clearInterval(timer); window.removeEventListener('focus', checkDay); };
  }, []);
  const { data, error, reload } = useDriverData(`/api/drivers/me/earnings?day=${day}`);
  const date = (value) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" }).format(
      new Date(`${value}T12:00:00Z`),
    );
  if (!data)
    return (
      <div className="driver-tab-page">
        <h1>Revenus</h1>
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button className="driver-chip" onClick={reload}>
              Réessayer
            </button>
          </div>
        ) : (
          <Loading label="Chargement des revenus…" />
        )}
      </div>
    );
  const week = data.week;
  const max = Math.max(1, ...week.byDay.map((row) => row.earnings));
  const selected = week.byDay.find((row) => row._id === selectedDay);
  const rides = data.recentRides || [];
  return (
    <div className="driver-tab-page earnings-page">
      <div className="driver-tab-title">
        <div>
          <h1>Revenus</h1>
        </div>
      </div>
      {error && (
        <p className="driver-notice" role="alert">
          Les données n’ont pas pu être actualisées. {error}
        </p>
      )}
      <div className="earnings-week-controls">
        <button
          onClick={() => {
            setDay(shiftDay(day, -7));
            setSelectedDay(shiftDay(day, -7));
          }}
          aria-label="Semaine précédente"
        >
          <ChevronLeft size={23} />
        </button>
        <span>
          {date(week.start)} – {date(shiftDay(week.end, -1))}
        </span>
        <button
          disabled={week.end > parisDay()}
          onClick={() => {
            setDay(shiftDay(day, 7));
            setSelectedDay(shiftDay(day, 7));
          }}
          aria-label="Semaine suivante"
        >
          <ChevronRight size={23} />
        </button>
      </div>
      <div className="earnings-overview">
        <div>
          <p>{selected ? date(selected._id) : "Cette semaine"}</p>
          <strong>{money(selected ? selected.earnings : week.total)}</strong>
        </div>
        <div className="earnings-chart" aria-label="Revenus journaliers">
          {week.byDay.map((row, index) => (
            <button
              key={row._id}
              className={selectedDay === row._id ? "selected" : ""}
              onClick={() => { setDay(row._id); setSelectedDay(row._id); }}
              aria-label={`${date(row._id)} : ${money(row.earnings)}, ${row.trips} courses, ${workDuration(row.onlineSeconds)}`}
              aria-pressed={selectedDay === row._id}
            >
              <span style={{ height: row.earnings > 0 ? `${Math.max(3, (row.earnings / max) * 100)}%` : 0 }} />
              <small>{["L", "M", "M", "J", "V", "S", "D"][index]}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="earnings-stats">
        <div>
          <span>Temps de connexion</span>
          <strong>{workDuration(selected ? selected.onlineSeconds : week.onlineSeconds)}</strong>
        </div>
        <div>
          <span>Courses</span>
          <strong>{selected ? selected.trips : week.trips}</strong>
        </div>
        <button type="button" className="earnings-rating-button" onClick={() => setRatingsOpen(true)} aria-label="Voir ma note chauffeur et mes avis">
          <span>Note chauffeur</span>
          <strong>{Number(data.stats?.averageRating ?? 5).toFixed(2)}</strong>
        </button>
      </div>
      <DriverRatings open={ratingsOpen} onClose={() => setRatingsOpen(false)} />
      <section className="earnings-daily-rides" aria-label="Courses du jour">
        {rides.length === 0 && <p className="muted">Aucune course terminée le {date(day)}.</p>}
        <div className="flex-col gap-3">
          {rides.map((ride) => (
            <article key={ride.id || ride._id} className="card card-pad">
              <div className="flex items-center justify-between mb-3" style={{ gap: 8 }}>
                <span className="tiny muted">{new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ride.completedAt))}</span>
                <RideStatusBadge status="completed" />
              </div>
              <div className="flex-col gap-1 small">
                <div className="flex gap-2 items-center"><Circle size={12} style={{ flexShrink: 0, color: 'var(--gold-600)' }} /><span>Prise en charge à {ride.pickup?.city || ride.pickup?.address || 'Départ'}</span></div>
                <div className="flex gap-2 items-center"><MapPin size={12} style={{ flexShrink: 0, color: 'var(--gold-600)' }} /><span>Dépose à {ride.dropoff?.city || ride.dropoff?.address || 'Destination'}</span></div>
              </div>
              <div className="flex items-center justify-between mt-3" style={{ borderTop: '1px solid var(--ink-100)', paddingTop: 10, gap: 8 }}>
                <span className="tiny muted">Vous avez gagné</span>
                <strong className="small mono-nums" style={{ color: 'var(--success)' }}>+{money(ride.fare?.driverEarnings)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Link href="/driver/wallet" className="driver-menu-row earnings-balance">
        <span>Solde</span>
        <strong>{money(data.wallet.balance)}</strong>
        <ChevronRight size={21} />
      </Link>
      <details className="earnings-payout">
        <summary>Versements et retraits</summary>
        <PayoutCard />
      </details>
    </div>
  );
}
export const Route = createFileRoute("/_authenticated/driver/earnings")({
  head: () => ({ meta: [{ title: "Revenus · StrasDrive" }] }),
  component: () => (
    <DriverLayout>
      <EarningsPage />
    </DriverLayout>
  ),
});
