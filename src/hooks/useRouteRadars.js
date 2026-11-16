import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/archive-fetch';
import { remainingRoute } from '@/lib/utils/route-display';
import { radarsOnRoute } from '@/lib/route-radars';

export default function useRouteRadars(rideId, status, geometry, position) {
  const [data, setData] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const progress = useRef({ geometry: null, value: 0 });
  const enabled = Boolean(rideId && geometry && ['accepted', 'in_progress'].includes(status));

  useEffect(() => {
    if (progress.current.geometry !== geometry) progress.current = { geometry, value: 0 };
    const result = remainingRoute(geometry, position, progress.current.value);
    progress.current.value = result.progress;
    setRemaining({ original: geometry, geometry: result.geometry });
  }, [geometry, position?.lat, position?.lng]);

  useEffect(() => {
    setData(null);
    if (!enabled) return;
    let stopped = false, timer;
    const load = async () => {
      let delay = 10000;
      try {
        const response = await apiFetch(`/api/rides/${rideId}/radars`);
        const result = await response.json();
        if (!stopped && response.ok) {
          setData({ ...result, geometry, rideId, status });
          if (result.available) delay = 60000;
        } else if (!stopped) setData({ available: false, geometry, rideId, status });
      } catch {
        if (!stopped) setData({ available: false, geometry, rideId, status });
      }
      if (!stopped) timer = setTimeout(load, delay);
    };
    load();
    return () => { stopped = true; clearTimeout(timer); };
  }, [rideId, status, geometry, enabled]);

  return useMemo(() => {
    if (!enabled || !position || data?.geometry !== geometry || data?.rideId !== rideId || data?.status !== status) return { count: null, loading: true };
    if (!data.available) return { count: null, loading: false };
    const road = remaining?.original === geometry ? remaining.geometry : geometry;
    return { count: radarsOnRoute(data.cameras || [], road).length, loading: false };
  }, [enabled, position, data, geometry, rideId, status, remaining]);
}
