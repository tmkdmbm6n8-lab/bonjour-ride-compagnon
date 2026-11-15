import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/archive-fetch';
export default function useDriverData(path, interval = 60000) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    let stopped = false, timer, loaded = false;
    setData(null); setError('');
    async function tick() {
      if (stopped) return;
      if (loaded && document.hidden) { timer = setTimeout(tick, interval); return; }
      try {
        const response = await apiFetch(path);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Chargement impossible');
        if (!stopped) { loaded = true; setData(payload); setError(''); }
      } catch (e) { if (!stopped) setError(e.message || 'Connexion indisponible'); }
      finally { if (!stopped && interval) timer = setTimeout(tick, interval); }
    }
    tick(); return () => { stopped = true; clearTimeout(timer); };
  }, [path, interval, revision]);
  return { data, error, reload: () => setRevision((n) => n + 1) };
}