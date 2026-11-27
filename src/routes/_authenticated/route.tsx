import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { verifySessionUser } from '@/lib/archive-auth';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    // Si l'appareil est hors-ligne, ne jamais expulser l'utilisateur vers /login
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }
    const { data: { user } } = await verifySessionUser();
    if (!user) throw redirect({ to: '/login' });
  },
  component: Outlet,
});
