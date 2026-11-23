'use client';
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useSession } from '@/lib/archive-auth';
import { usePathname } from '@/lib/archive-navigation';
import useDriverState from '@/hooks/useDriverState';
import DriverIncomingOffer from '@/components/driver/DriverIncomingOffer';
const DriverActivityContext = createContext(null);

/** A single controller survives every driver-tab navigation. */
export function DriverActivityProvider({ children }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const enabled = status === 'authenticated' && Boolean(session?.user?.canDrive || session?.user?.role === 'driver') && /^\/driver(?:\/|$)/.test(pathname);
  const listeners = useRef(new Set());
  const notify = useCallback((type, data) => { for (const fn of listeners.current) fn(type, data); }, []);
  const subscribe = useCallback(fn => { listeners.current.add(fn); return () => listeners.current.delete(fn); }, []);
  const activity = useDriverState({ enabled, userId: session?.user?.id, onEvent: notify });
  return <DriverActivityContext.Provider value={{ ...activity, enabled, subscribe }}>
    {children}
    <DriverIncomingOffer />
  </DriverActivityContext.Provider>;
}
export function useDriverActivity({ onEvent } = {}) {
  const value = useContext(DriverActivityContext);
  const callback = useRef(onEvent);
  callback.current = onEvent;
  useEffect(() => {
    if (!value?.subscribe || !onEvent) return;
    return value.subscribe((...args) => callback.current?.(...args));
  }, [value?.subscribe, Boolean(onEvent)]);
  if (!value) throw new Error('DriverActivityProvider manquant');
  return value;
}
