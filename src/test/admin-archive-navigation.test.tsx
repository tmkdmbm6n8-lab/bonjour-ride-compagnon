// @ts-nocheck
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import AppShell from '@/components/shell/AppShell';

vi.mock('@/lib/archive-auth', () => ({ useSession: () => ({ data: { user: { role: 'admin' } } }), signOut: vi.fn() }));
vi.mock('@/components/shell/RiderAccountMenu', () => ({ default: () => null }));
afterEach(cleanup);
const Icon = () => null;
const nav = [{ href: '/admin/support', label: 'Assistance', icon: Icon }, { href: '/admin/support?archive=1', label: 'Archives', icon: Icon }];

describe('navigation entre Assistance et Archives', () => {
  it.each([
    ['/admin/support', 'Assistance', 'Archives'],
    ['/admin/support?archive=1', 'Archives', 'Assistance'],
  ])('ne colore que l’onglet actif sur %s', async (url, selected, other) => {
    const root = createRootRoute({ component: () => <AppShell variant="admin" nav={nav}><div>Contenu</div></AppShell> });
    const support = createRoute({ getParentRoute: () => root, path: '/admin/support', component: () => null });
    const router = createRouter({ routeTree: root.addChildren([support]), history: createMemoryHistory({ initialEntries: [url] }) });
    await router.load();
    render(<RouterProvider router={router} />);
    const selectedLink = await screen.findByRole('link', { name: selected });
    const otherLink = screen.getByRole('link', { name: other });
    expect(selectedLink.classList.contains('active')).toBe(true);
    expect(otherLink.classList.contains('active')).toBe(false);
    expect(selectedLink.getAttribute('aria-current')).toBe('page');
    expect(otherLink.getAttribute('aria-current')).toBeNull();
  });
});
