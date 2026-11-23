'use client';

import { SessionProvider } from '@/lib/archive-auth';
import { SocketProvider } from '@/context/SocketProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { DriverActivityProvider } from '@/context/DriverActivityProvider';
import AppUpdateWatcher from '@/components/AppUpdateWatcher';

/** Client providers for the authenticated app surfaces. */
export default function Providers({ children }) {
  return (
    <SessionProvider>
      <SocketProvider>
        <ToastProvider><DriverActivityProvider>{children}<AppUpdateWatcher /></DriverActivityProvider></ToastProvider>
      </SocketProvider>
    </SessionProvider>
  );
}
