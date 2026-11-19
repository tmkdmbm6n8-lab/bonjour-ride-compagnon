import { Heart } from "lucide-react";
import { Avatar, VEHICLE_LABELS, money } from "@/components/ui/bits";

const STATUS_TEXT = {
  busy: "En course en ce moment",
  offline: "Indisponible pour le moment",
};

/** First row of the ride comparator: the rider's favorite driver with his live approach time. */
export default function FavoriteQuoteRow({ favorite, selected, onSelect }) {
  if (!favorite) return null;
  const available = favorite.status === "available" && Boolean(favorite.fare);
  const statusText = available
    ? favorite.etaMinutes != null
      ? `Arrive dans ${favorite.etaMinutes} min`
      : "Disponible · délai indisponible"
    : STATUS_TEXT[favorite.status] || STATUS_TEXT.offline;
  const vehicle = [favorite.vehicle?.make, favorite.vehicle?.model].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      className={`vehicle-row favorite-quote-row ${selected ? "selected" : ""}`}
      onClick={available ? onSelect : undefined}
      aria-pressed={selected}
      aria-disabled={!available}
      disabled={!available}
      style={!available ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
    >
      <Avatar name={favorite.name || ""} src={favorite.avatar || ""} size="sm" />
      <span className="flex-1" style={{ minWidth: 0 }}>
        <span className="small flex items-center gap-1" style={{ fontWeight: 700 }}>
          <Heart size={13} fill="currentColor" style={{ color: "var(--gold-600)", flexShrink: 0 }} aria-hidden="true" />
          <span className="truncate">{favorite.name}</span>
        </span>
        <span className="tiny muted truncate" style={{ display: "block" }}>
          Votre chauffeur favori · {VEHICLE_LABELS[favorite.vehicleType] || ""}
          {vehicle ? ` · ${vehicle}` : ""}
        </span>
        <span
          className="tiny vehicle-availability"
          style={{ display: "block", fontWeight: 600, color: available ? "var(--success)" : "var(--text-2)" }}
        >
          {statusText}
        </span>
      </span>
      {favorite.fare && (
        <span className="small mono-nums" style={{ fontWeight: 700 }}>
          {money(favorite.fare.total)}
        </span>
      )}
    </button>
  );
}
