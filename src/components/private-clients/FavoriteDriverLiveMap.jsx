import { lazy, Suspense, useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { apiFetch } from "@/lib/archive-fetch";
import { watchRefresh } from "@/lib/live-refresh";

const MapView = lazy(() => import("@/components/maps/MapView"));
const messages = {
  loading: "Recherche de la position…",
  offline: "Votre chauffeur est hors ligne.",
  waiting: "En attente d’une position GPS récente.",
  unavailable: "La position de ce chauffeur est indisponible.",
};

export default function FavoriteDriverLiveMap({ driverId, onClose }) {
  const [location, setLocation] = useState({ status: "loading" });

  useEffect(() => {
    let expiry;
    const stop = watchRefresh(async (isCurrent, signal) => {
      const started = Date.now();
      try {
        const response = await apiFetch("/api/riders/me/favorite/location", { signal });
        const data = await response.json();
        if (!isCurrent() || signal.aborted || document.hidden) return;
        clearTimeout(expiry);
        if (!response.ok || (data.driverId && data.driverId !== driverId)) {
          setLocation({ status: "unavailable" });
          return;
        }
        if (data.status === "online") {
          const remaining = data.expiresInMs - (Date.now() - started);
          if (!Number.isFinite(remaining) || remaining <= 0 || !data.position) {
            setLocation({ status: "waiting" });
            return;
          }
          expiry = setTimeout(() => setLocation({ status: "waiting" }), remaining);
        }
        setLocation(data);
      } catch {
        if (isCurrent() && !signal.aborted) setLocation({ status: "unavailable" });
      }
    }, 5000);
    const clearOnHide = () => {
      if (!document.hidden) return;
      clearTimeout(expiry);
      setLocation({ status: "loading" });
    };
    document.addEventListener("visibilitychange", clearOnHide);
    return () => {
      stop();
      clearTimeout(expiry);
      document.removeEventListener("visibilitychange", clearOnHide);
    };
  }, [driverId]);

  return (
    <Modal open onClose={onClose} title="Votre chauffeur sur la carte" portal sheetOnMobile={false} maxWidth={620}>
      {location.status === "online" ? (
        <>
          <p className="small muted mb-2">En ligne · position approximative</p>
          <div style={{ height: "min(52dvh, 420px)", overflow: "hidden", borderRadius: 14 }}>
            <Suspense fallback={<p role="status">Chargement de la carte…</p>}>
              <MapView
                center={location.position}
                followPosition={location.position}
                drivers={[{ id: driverId, location: location.position }]}
              />
            </Suspense>
          </div>
        </>
      ) : <p className="small muted" role="status">{messages[location.status] || messages.unavailable}</p>}
    </Modal>
  );
}
