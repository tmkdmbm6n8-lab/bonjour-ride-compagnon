import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/archive-fetch';
import { cameraBounds } from '@/lib/vtc-speed-cameras';

/** Query only after the camera settles; stale requests never replace a newer view. */
export default function useMapSpeedCameras(mapRef, enabled = true) {
  const [cameras, setCameras] = useState([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enabled) return undefined;
    let stopped = false, timer, generation = 0, lastKey = '', lastAt = 0;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const bounds = map.getBounds();
        const bbox = [Math.max(-180, bounds.getWest()), Math.max(-90, bounds.getSouth()), Math.min(180, bounds.getEast()), Math.min(90, bounds.getNorth())];
        if (map.getZoom() < 9 || bbox[2] - bbox[0] > 1 || bbox[3] - bbox[1] > 1 || bbox[2] <= bbox[0] || bbox[3] <= bbox[1]) { generation++; lastKey = ''; setCameras([]); return; }
        const key = cameraBounds(bbox).join(',');
        if (key === lastKey && Date.now() - lastAt < 60_000) return;
        const requestId = ++generation;
        lastKey = key; lastAt = Date.now();
        try {
          const res = await apiFetch(`/api/maps/speed-cameras?bbox=${encodeURIComponent(bbox.join(','))}`);
          const data = await res.json();
          if (!stopped && requestId === generation && res.ok && Array.isArray(data.cameras)) {
            setCameras(data.cameras);
            if (!data.available) timer = setTimeout(schedule, 61_000);
          }
        } catch { /* Community alerts remain visible if Overpass is unavailable. */ }
      }, 650);
    };
    map.on('load', schedule);
    map.on('moveend', schedule);
    schedule();
    return () => { stopped = true; generation++; clearTimeout(timer); map.off('load', schedule); map.off('moveend', schedule); };
  }, [mapRef, enabled]);
  return cameras;
}
