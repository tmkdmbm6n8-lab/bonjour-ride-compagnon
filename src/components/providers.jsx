'use client';

import { SessionProvider } from '@/lib/archive-auth';
import { SocketProvider } from '@/context/SocketProvider';
import { ToastProvider } from '@/components/ui/Toast';

/** Client providers for the authenticated app surfaces. */
export default function Providers({ children }) {
  return (
    <SessionProvider>
      <SocketProvider>
        <ToastProvider>{children}</ToastProvider>
      </SocketProvider>
    </SessionProvider>
  );
}
