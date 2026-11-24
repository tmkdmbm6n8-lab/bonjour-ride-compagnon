import { useEffect, useState } from "react";
import { FREE_WAIT_SECONDS, pickupWaiting } from "@/lib/ride-waiting";
import { money } from "@/components/ui/bits";

export default function PickupWaitingTimer({ arrivedAt, rate = 0 }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const wait = pickupWaiting(arrivedAt, now, rate);
  const billable = rate > 0;
  const free = billable && wait.seconds < FREE_WAIT_SECONDS;
  const seconds = free ? FREE_WAIT_SECONDS - wait.seconds : billable ? wait.billableSeconds : wait.seconds;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="pickup-wait-timer">
      <div className="flex items-center justify-between">
        <strong>{free ? "Attente gratuite restante" : billable ? "Attente facturable" : "Temps d’attente"}</strong>
        <time className="mono-nums">{clock}</time>
      </div>
      {billable && <>
      <progress max={FREE_WAIT_SECONDS} value={Math.min(FREE_WAIT_SECONDS, wait.seconds)} aria-label="Temps d’attente gratuite écoulé" />
      <div className="flex items-center justify-between small">
        <span>{money(rate / 100)} / min après 2 min</span>
        <strong>{money(wait.cents / 100)}</strong>
      </div>
      </>}
    </div>
  );
}
