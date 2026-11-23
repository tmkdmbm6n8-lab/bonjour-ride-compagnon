'use client';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/archive-auth';
import { usePathname } from '@/lib/archive-navigation';
import { apiFetch } from '@/lib/archive-fetch';
import { watchRefresh } from '@/lib/live-refresh';
import { canApplyAppUpdate } from '@/lib/app-update';

const currentBuild = typeof __STRASDRIVE_BUILD_ID__ === 'string' ? __STRASDRIVE_BUILD_ID__ : null;
export default function AppUpdateWatcher() {
  const { status, live } = useSession();
  const pathname = usePathname();
  const [available, setAvailable] = useState(false);
  const state = useRef({});
  const interaction = useRef(Date.now());
  const dirty = useRef(false);
  state.current = { status, live, pathname };
  useEffect(() => { dirty.current = false; interaction.current = Date.now(); }, [pathname]);
  useEffect(() => {
    if (!currentBuild) return;
    const touch = () => { interaction.current = Date.now(); };
    const edit = () => { dirty.current = true; touch(); };
    for (const event of ['pointerdown', 'keydown']) window.addEventListener(event, touch, true);
    for (const event of ['input', 'change']) window.addEventListener(event, edit, true);
    const stop = watchRefresh(async (active, signal) => {
      const response = await apiFetch('/api/public/app-version', { signal });
      if (!response.ok) return;
      const { buildId } = await response.json();
      if (!active() || !buildId || buildId === currentBuild) return;
      setAvailable(true);
      const safe = canApplyAppUpdate({ ...state.current, dirty: dirty.current,
        idleMs: Date.now() - interaction.current, focusedTag: document.activeElement?.tagName,
        dialogOpen: Boolean(document.querySelector('[aria-modal="true"]')) });
      if (!safe) return;
      // Mixed versions during rollout must never cause a reload loop.
      try {
        const last = JSON.parse(sessionStorage.getItem('strasdrive:last-auto-update') || 'null');
        if (last && Date.now() - last.at < 300000) return;
        sessionStorage.setItem('strasdrive:last-auto-update', JSON.stringify({ buildId, at: Date.now() }));
      } catch { return; }
      window.location.reload();
    }, 30000);
    return () => {
      stop();
      for (const event of ['pointerdown', 'keydown']) window.removeEventListener(event, touch, true);
      for (const event of ['input', 'change']) window.removeEventListener(event, edit, true);
    };
  }, []);
  if (!available) return null;
  return <div role="status" className="app-update-notice">
    <span>{live?.hasActiveRide ? 'Une mise à jour sera appliquée après votre course.' : 'Une mise à jour est disponible.'}</span>
    {!live?.hasActiveRide && <button type="button" onClick={() => { if (!dirty.current || window.confirm('Actualiser la page ? Vos modifications non enregistrées seront perdues.')) window.location.reload(); }}>Actualiser</button>}
  </div>;
}
