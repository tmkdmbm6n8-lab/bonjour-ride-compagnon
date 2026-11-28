import { lazy, Suspense, useEffect, useState } from "react";
import { apiFetch } from "@/lib/archive-fetch";
import { watchRefresh } from "@/lib/live-refresh";

const MapView = lazy(() => import("@/components/maps/MapView"));
const STRASBOURG = { lat: 48.5734, lng: 7.7521 };

export default function FavoriteDriverLiveMap({ driverId }) {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    let expiry;
    const stop = watchRefresh(async (isCurrent, signal) => {
      const started = Date.now();
      try {
        const response = await apiFetch("/api/riders/me/favorite/location", { signal });
        const data = await response.json();
        if (!isCurrent() || signal.aborted || document.hidden) return;
        clearTimeout(expiry);
        const remaining = data.expiresInMs - (Date.now() - started);
        if (!response.ok || data.driverId !== driverId || data.status !== "online" ||
            !data.position || !Number.isFinite(remaining) || remaining <= 0) {
          setPosition(null);
          return;
        }
        expiry = setTimeout(() => setPosition(null), remaining);
        setPosition(data.position);
      } catch {
        if (isCurrent() && !signal.aborted) setPosition(null);
      }
    }, 5000);
    const clearOnHide = () => {
      if (!document.hidden) return;
      clearTimeout(expiry);
      setPosition(null);
    };
    document.addEventListener("visibilitychange", clearOnHide);
    return () => {
      stop();
      clearTimeout(expiry);
      document.removeEventListener("visibilitychange", clearOnHide);
    };
  }, [driverId]);

  return (
    <div className="mt-4" style={{ height: "clamp(200px, 34dvh, 320px)", overflow: "hidden", borderRadius: 14 }}>
      <Suspense fallback={null}>
        <MapView
          center={position ?? STRASBOURG}
          followPosition={position}
          drivers={position ? [{ id: driverId, location: position }] : []}
        />
      </Suspense>
    </div>
  );
}
