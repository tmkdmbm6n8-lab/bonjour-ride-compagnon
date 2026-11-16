import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomeRideEstimator from '@/components/home/HomeRideEstimator';
import { clearRideDraft, readRideDraft, saveRideDraft } from '@/lib/ride-draft';

vi.mock('@/lib/archive-auth', () => ({ useSession: () => ({ data: null }) }));
vi.mock('@/lib/archive-navigation', () => ({ default: ({ href, children }: any) => <a href={href}>{children}</a> }));
vi.mock('@/lib/vtc.functions', () => ({ homeEstimate: vi.fn(async () => ({
  route: { durationSeconds: 300 }, estimates: { economy: { total: 12 }, comfort: { total: 15 } },
})) }));
vi.mock('@/components/maps/PlaceSearch', () => ({ default: ({ value, onChangeText, onSelect, placeholder }: any) => (
  <div>
    <input placeholder={placeholder} value={value} onChange={e => onChangeText(e.target.value)} />
    <button onClick={() => onSelect({ address: value, lat: 48.58, lng: 7.73 })}>Choisir {placeholder}</button>
  </div>
) }));
afterEach(() => { cleanup(); clearRideDraft(); });

describe('trajet sur l’accueil public', () => {
  it('sauvegarde avant inscription, affiche les tarifs et invalide les coordonnées lors d’une modification', async () => {
    render(<HomeRideEstimator />);
    const pickup = screen.getByPlaceholderText('Point de départ');
    const dropoff = screen.getByPlaceholderText('Point d’arrivée');
    fireEvent.change(pickup, { target: { value: 'Gare Strasbourg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choisir Point de départ' }));
    fireEvent.change(dropoff, { target: { value: 'Place Kléber' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choisir Point d’arrivée' }));
    expect(await screen.findByRole('link', { name: /Réserver cette course/ })).toHaveAttribute('href', '/signup');
    expect(readRideDraft()?.pickup?.address).toBe('Gare Strasbourg');
    expect(readRideDraft()?.dropoff?.address).toBe('Place Kléber');
    fireEvent.change(pickup, { target: { value: 'Autre départ' } });
    expect(readRideDraft()?.pickup).toBeNull();
    expect(readRideDraft()?.pickupText).toBe('Autre départ');
  });

  it('restaure aussi une saisie partielle après un retour sur l’accueil', async () => {
    saveRideDraft({ pickup: null, dropoff: null, pickupText: 'Gare en cours de saisie', dropoffText: '' });
    render(<HomeRideEstimator />);
    await waitFor(() => expect(screen.getByPlaceholderText('Point de départ')).toHaveValue('Gare en cours de saisie'));
    expect(readRideDraft()?.pickupText).toBe('Gare en cours de saisie');
  });
});
