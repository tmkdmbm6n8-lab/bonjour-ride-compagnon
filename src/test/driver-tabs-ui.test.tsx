import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DriverLayout from '@/components/DriverLayout';
import { Route as DiscoverRoute } from '@/routes/_authenticated.driver.discover';
import { Route as EarningsRoute } from '@/routes/_authenticated.driver.earnings';
import { Route as InboxRoute } from '@/routes/_authenticated.driver.inbox';
import { Route as MenuRoute } from '@/routes/_authenticated.driver.menu';
const fixtures = vi.hoisted(() => ({ data: {} as Record<string, any> }));
vi.mock('@/components/shell/AppShell', () => ({ default: ({ nav, children }: any) => <><nav>{nav.map((item: any) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>{children}</> }));
vi.mock('@/lib/archive-navigation', () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));
vi.mock('@/hooks/useDriverData', () => ({ default: (path: string) => ({ data: fixtures.data[path.split('?')[0]] || null, error: '', reload: vi.fn() }) }));
vi.mock('@/lib/archive-auth', () => ({ useSession: () => ({ data: { user: { id: 'driver-a', name: 'Tigran' } } }), signOut: vi.fn() }));
vi.mock('@/components/driver/PayoutCard', () => ({ default: () => <div>Versements</div> }));
vi.mock('@/components/driver/Waybill', () => ({ default: () => null }));
vi.mock('@/components/ArchiveMap', () => ({ default: () => <div>Carte</div> }));
vi.mock('@/components/ui/Modal', () => ({ default: ({ open, children, title }: any) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
vi.mock('@/hooks/useVisualViewport', () => ({ default: () => null }));
afterEach(() => { cleanup(); fixtures.data = {}; localStorage.clear(); });
describe('onglets chauffeur', () => {
  it('sépare Découvrir, Inbox et Menu des préférences de conduite', () => {
    render(<DriverLayout><div /></DriverLayout>);
    expect(screen.getByRole('link', { name: 'Découvrir' }).getAttribute('href')).toBe('/driver/discover');
    expect(screen.getByRole('link', { name: 'Inbox' }).getAttribute('href')).toBe('/driver/inbox');
    expect(screen.getByRole('link', { name: 'Menu' }).getAttribute('href')).toBe('/driver/menu');
  });
  it('ne remplace pas une date non publiée par de faux vols', () => {
    fixtures.data['/api/drivers/me/discover'] = { day: '2026-11-15', items: [], feeds: [{ kind: 'flight', warning: 'Horaires non publiés' }] };
    const Component = DiscoverRoute.options.component as any;
    render(<Component />);
    expect(screen.getByText('Horaires non publiés')).toBeTruthy();
    expect(screen.getByText('Aucun horaire disponible pour cette sélection.')).toBeTruthy();
  });
  it('affiche les vrais totaux et permet de choisir un jour', () => {
    fixtures.data['/api/drivers/me/earnings'] = { week: { start: '2026-11-09', end: '2026-11-16', total: 42, trips: 2, activitySeconds: 3600, byDay: [{ _id: '2026-11-09', earnings: 12, trips: 1, activitySeconds: 1200 }, { _id: '2026-11-10', earnings: 30, trips: 1, activitySeconds: 2400 }] }, stats: { averageRating: 4.9 }, wallet: { balance: 50 }, recentRides: [] };
    const Component = EarningsRoute.options.component as any;
    render(<Component />);
    expect(screen.getByText(/42,00/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /9 nov.*12,00/ }));
    expect(screen.getByText(/12,00/)).toBeTruthy();
    expect(screen.getByText('0 h 20')).toBeTruthy();
  });
  it('ouvre une conversation administrateur réelle depuis Inbox', () => {
    fixtures.data['/api/drivers/me/inbox'] = { threads: [{ id: 'thread-1', subject: 'Mon versement', messages: [{ id: 'm1', from: 'admin', text: 'Votre virement est en cours.', createdAt: '2026-11-15T10:00:00Z' }], status: 'open', updatedAt: '2026-11-15T10:00:00Z' }], rides: [], hasMore: false };
    const Component = InboxRoute.options.component as any;
    render(<Component />);
    fireEvent.click(screen.getByRole('button', { name: /Mon versement/ }));
    expect(screen.getByRole('dialog', { name: 'Mon versement' })).toBeTruthy();
    expect(screen.getByText('Administration StrasDrive')).toBeTruthy();
  });
  it('présente toutes les sections du menu dans la même page', () => {
    fixtures.data['/api/users/me'] = { user: { name: 'Tigran', email: 'driver@example.com', rating: { average: 4.99 } } };
    fixtures.data['/api/drivers/me'] = { driver: { isApproved: true, vehicle: { make: 'MG', model: 'ZS', plate: 'HJ415HF' } } };
    const Component = MenuRoute.options.component as any;
    render(<Component />);
    expect(screen.getByText('Tigran')).toBeTruthy();
    for (const title of ['Gérer', 'Argent', 'Ressources']) expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Se déconnecter/ })).toBeTruthy();
  });
});