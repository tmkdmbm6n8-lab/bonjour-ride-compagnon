import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { localSessionUser } from '@/lib/offline-session';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  // Changing tab only reads the session saved on the phone: no network call,
  // so airplane mode can never send the driver to the login page. Every API
  // request is still verified by the server, and SessionProvider re-checks online.
  beforeLoad: async () => {
    const user = await localSessionUser();
    if (!user) throw redirect({ to: '/login' });
  },
  component: Outlet,
});
