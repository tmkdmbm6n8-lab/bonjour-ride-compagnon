import { useEffect, useState } from 'react';
import { apiFetch as fetch } from '@/lib/archive-fetch';

const REFRESH_MS = 50000; // the server shares one traffic-aware route per ride for ~45 s

/**
 * Traffic-aware route from the driver's position to the current leg target
 * (pickup while `accepted`, destination while `in_progress`). Shared by rider and driver.
 */
export function useLiveRoute(rideId, status) {
  const [route, setRoute] = useState(null);
  const live = status === 'accepted' || status === 'in_progress';
  useEffect(() => {
    setRoute(null);
    if (!rideId || !live) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/rides/${rideId}/route`);
        const data = await res.json();
        if (!cancelled && res.ok && data.route) setRoute(data.route);
      } catch { /* keep the last route */ }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [rideId, status, live]);
  return route;
}
