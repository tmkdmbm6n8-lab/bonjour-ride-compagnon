import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/archive-fetch';
import { watchRefresh } from '@/lib/live-refresh';
import { recallRead } from '@/lib/offline-cache';
// Use the same cache as startup prefetch and sign-out cleanup.
const cached = (path) => recallRead(path) ?? null;
export default function useDriverData(path, interval = 60000) {
  const [data, setData] = useState(() => cached(path)), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    setData(cached(path)); setError('');
    // Traffic and historical earnings retain their existing cost-aware intervals.
    const delay = /\/(discover|earnings)(?:\?|$)/.test(path) ? interval : interval ? Math.min(interval, 5000) : 0;
    return watchRefresh(async (active, signal) => {
      try {
        const response = await apiFetch(path, { signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Chargement impossible');
        if (active()) { setData(payload); setError(''); }
      } catch (e) { if (active()) setError(e.message || 'Connexion indisponible'); }
    }, delay);
  }, [path, interval, revision]);
  return { data, error, reload: () => setRevision((n) => n + 1) };
}
