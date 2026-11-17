import { useEffect, useRef, useState } from "react";
import { Hand } from "lucide-react";

/** One non-reusable two-minute pause per ride on this browser; no fare or ride-status changes. */
export default function RidePauseButton({ rideId }) {
  const key = `strasdrive:ride-pause:${rideId}`;
  const [pause, setPause] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Number.isFinite(value?.startedAt) ? value : null;
    } catch {
      return null;
    }
  });
  const ref = useRef(pause);
  const [now, setNow] = useState(Date.now);
  const seconds =
    pause && !pause.stopped ? Math.max(0, Math.ceil((pause.startedAt + 120000 - now) / 1000)) : 0;
  useEffect(() => {
    if (!seconds) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [Boolean(seconds)]);
  function press() {
    const current = ref.current;
    if (current && (current.stopped || Date.now() >= current.startedAt + 120000)) return;
    const next = current
      ? { ...current, stopped: true }
      : { startedAt: Date.now(), stopped: false };
    ref.current = next;
    setPause(next);
    setNow(Date.now());
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Keep the one-use state in memory if storage is unavailable. */
    }
  }
  return (
    <button
      type="button"
      className={`drv-action-pill drv-pause-pill ${seconds ? "is-active" : ""}`}
      aria-pressed={seconds > 0}
      disabled={Boolean(pause) && !seconds}
      onClick={press}
      title={
        pause && !seconds
          ? "La pause de cette course a déjà été utilisée."
          : "Une seule pause de deux minutes. L’arrêter annule le temps restant."
      }
    >
      <Hand size={16} />
      <span>
        {seconds
          ? `Arrêter · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
          : pause
            ? "Pause utilisée"
            : "Pause · 2 min"}
      </span>
    </button>
  );
}
