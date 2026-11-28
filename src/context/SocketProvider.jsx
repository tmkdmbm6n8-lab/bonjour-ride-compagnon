import { usePathname } from "@/lib/archive-navigation";
import { accountView } from "@/lib/account-mode";
import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "@/lib/archive-auth";
import { apiFetch } from "@/lib/archive-fetch";
import { watchRefresh } from "@/lib/live-refresh";
const SocketContext = createContext({ socket: null, isConnected: false });
export function SocketProvider({ children }) {
  const view = accountView(usePathname());
  const { data: session, status } = useSession(),
    [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (status !== "authenticated") return;
    const listeners = new Map();
    let previous = null,
      offerId = null,
      offerKey = null,
      offerMetadata = null,
      stopped = false,
      inFlight = false;
    const fire = (event, data) => {
      if (!stopped) listeners.get(event)?.forEach((fn) => fn(data));
    };
    const instance = {
      on: (event, fn) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(fn);
      },
      off: (event, fn) => listeners.get(event)?.delete(fn),
      emit: (event, data) => {
        if (event === "driver:location")
          apiFetch("/api/drivers/location", { method: "POST", body: JSON.stringify(data) });
      },
    };
    setSocket(instance);
    async function tick(active, signal) {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        if (view === "driver" && (session.user.role === "driver" || session.user.canDrive)) {
          const res = await apiFetch("/api/drivers/offers", { signal });
          if (stopped) return;
          if (!res.ok) { setConnected(false); return; }
          const j = await res.json();
          const key = j.offer ? `${j.offer.rideId}:${j.offer.phase || ""}` : null;
          if (j.offer) {
            const metadata = JSON.stringify(j.offer.airportReturn || null);
            if (key !== offerKey) {
              offerId = j.offer.rideId;
              offerKey = key;
              offerMetadata = metadata;
              fire("ride:offer", j.offer);
            } else if (metadata !== offerMetadata) {
              offerMetadata = metadata;
              fire("ride:offer-updated", j.offer);
            }
          }
          if (!j.offer && offerId) {
            fire("ride:offer-expired", { rideId: offerId });
            offerId = null;
            offerKey = null;
            offerMetadata = null;
          }
        }
        if (view === "admin" && session.user.role === "admin") {
          setConnected(true);
          fire("ride:updated", {});
          return;
        }
        const res = await apiFetch(
          `/api/rides/active?view=${view === "driver" ? "driver" : "rider"}`, { signal },
        );
        if (stopped) return;
        if (!res.ok) { setConnected(false); return; }
        setConnected(true);
        const { ride } = await res.json();
        if (ride) {
          if (ride.status !== previous?.status) {
            const events = {
              accepted: "ride:accepted",
              arrived: "ride:driver-arrived",
              in_progress: "ride:started",
            };
            if (events[ride.status]) fire(events[ride.status], { ride });
          }
          if (ride.driver?.location) fire("driver:location", { location: ride.driver.location });
          const oldCount =
            previous?.id === ride.id ? previous.messages?.length || 0 : ride.messages?.length || 0;
          for (const m of (ride.messages || []).slice(oldCount))
            fire("ride:message", { rideId: ride.id, ...m });
        } else if (previous) {
          const detail = await apiFetch(`/api/rides/${previous.id}`, { signal });
          const j = await detail.json();
          if (j.ride?.status === "completed")
            fire("ride:completed", { fare: j.ride.fare, payment: j.ride.payment });
          else if (j.ride?.status === "no_drivers") fire("ride:no-drivers", {});
          else if (j.ride?.status === "cancelled") fire("ride:cancelled", { rideId: previous.id });
        }
        previous = ride;
      } catch {
        if (!stopped) setConnected(false);
      } finally {
        inFlight = false;
      }
    }
    const stopRefresh = watchRefresh(tick, 2500);
    return () => {
      stopped = true;
      stopRefresh();
      setConnected(false);
      setSocket(null);
    };
  }, [status, session?.user?.id, session?.user?.role, session?.user?.canDrive, view]);
  return (
    <SocketContext.Provider value={{ socket, isConnected: Boolean(socket) && connected }}>
      {children}
    </SocketContext.Provider>
  );
}
export function useSocket() {
  return useContext(SocketContext);
}
