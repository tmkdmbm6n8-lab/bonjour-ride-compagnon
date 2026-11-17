import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PassengerInfo from '@/components/driver/PassengerInfo';
import AdminLayout from '@/components/AdminLayout';
import { passengerDisplayName } from '@/lib/passenger-name';
vi.mock('@/components/shell/AppShell', () => ({ default: ({ nav, variant, children }: any) => <div data-testid="shell" data-variant={variant}>{nav.map((n: any) => <a key={n.href} href={n.href}>{n.label}</a>)}{children}</div> }));
afterEach(cleanup);
describe('fiche passager et accès admin', () => {
  it('conserve les prénoms et seulement l’initiale du nom, même déjà abrégé', () => {
    expect(passengerDisplayName('Jean Pierre Dupont')).toBe('Jean Pierre D.');
    expect(passengerDisplayName('Jean Pierre D.')).toBe('Jean Pierre D.');
    expect(passengerDisplayName('Léa')).toBe('Léa');
    expect(passengerDisplayName(null)).toBe('Passager');
  });
  it('ouvre les informations au clic sans afficher le nom de famille complet', () => {
    render(<PassengerInfo ride={{ rider: { name: 'Alexandre Dupont', rating: 4.8, phone: '0600000000' }, pickup: { address: 'Gare' }, dropoff: { address: 'Aéroport' } }} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Informations du passager Alexandre D.' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('link', { name: '0600000000' })).toHaveAttribute('href', 'tel:0600000000');
    expect(screen.getByText('Aéroport')).toBeTruthy();
    expect(screen.queryByText(/Dupont/)).toBeNull();
  });
  it('affiche la fiche hors du bandeau et la ferme au clic extérieur uniquement', () => {
    const { container } = render(<div className="drv-top-passenger-bar"><PassengerInfo ride={{ rider: { name: 'Léa Martin' }, pickup: { address: 'Gare' } }} /></div>);
    fireEvent.click(screen.getByRole('button', { name: 'Informations du passager Léa M.' }));
    const dialog = screen.getByRole('dialog', { name: 'Informations du passager' });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(dialog).toBeVisible();
    fireEvent.click(screen.getByText('Gare'));
    expect(screen.getByRole('dialog')).toBeVisible();
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.position).toBe('');
  });
  it('expose Assistance et Signalements dans la navigation admin dédiée', () => {
    render(<AdminLayout><span>Admin</span></AdminLayout>);
    expect(screen.getByTestId('shell')).toHaveAttribute('data-variant', 'admin');
    expect(screen.getByRole('link', { name: 'Assistance' })).toHaveAttribute('href', '/admin/support');
    expect(screen.getByRole('link', { name: 'Signalements' })).toHaveAttribute('href', '/admin/alerts');
  });
  it('masque complètement le téléphone absent', () => {
    render(<PassengerInfo ride={{ rider: { name: 'Léa Martin', phone: '' } }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Informations du passager Léa M.' }));
    expect(screen.queryByText('Téléphone')).toBeNull();
    expect(screen.queryByText('Non renseigné')).toBeNull();
  });
});
