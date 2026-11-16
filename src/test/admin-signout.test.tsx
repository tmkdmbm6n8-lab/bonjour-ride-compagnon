import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AdminLayout from '@/components/AdminLayout';
const state = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('@/lib/archive-auth', () => ({ useSession: () => ({ data: { user: { role: 'admin', name: 'Admin' } } }), signOut: state.signOut }));
vi.mock('@/lib/archive-navigation', () => ({ usePathname: () => '/admin/dashboard', default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));
afterEach(cleanup);
it('affiche la déconnexion dans la navigation admin et ferme la session', () => {
  render(<AdminLayout><div>Admin</div></AdminLayout>);
  const button = screen.getByRole('button', { name: 'Se déconnecter' });
  expect(button.closest('nav')).toBeTruthy();
  fireEvent.click(button);
  expect(state.signOut).toHaveBeenCalledWith({ callbackUrl: '/' });
});
