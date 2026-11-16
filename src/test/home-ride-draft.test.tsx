import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomeRideEstimator from '@/components/home/HomeRideEstimator';
import { clearRideDraft, readRideDraft, saveRideDraft } from '@/lib/ride-draft';

vi.mock('@/lib/archive-auth', () => ({ useSession: () => ({ data: null }) }));
vi.mock('@/lib/archive-fetch', () => ({ apiFetch: vi.fn(async () => ({
  json: async () => ({ results: [{ address: 'Ma position à Strasbourg' }] }),
})) }));
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
afterEach(() => { cleanup(); clearRideDraft(); vi.restoreAllMocks(); });

describe('trajet sur l’accueil public', () => {
  it('localise sur demande et transmet le départ géolocalisé à la réservation', async () => {
    let success: any;
    const locate = vi.fn(callback => { success = callback; });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: locate } });
    render(<HomeRideEstimator />);
    expect(locate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Me localiser' }));
    expect(screen.getByRole('button', { name: 'Me localiser' })).toBeDisabled();
    await act(async () => { await success({ coords: { latitude: 48.58, longitude: 7.73 } }); });
    expect(screen.getByPlaceholderText('Point de départ')).toHaveValue('Ma position à Strasbourg');
    expect(readRideDraft()?.pickup).toEqual({ address: 'Ma position à Strasbourg', lat: 48.58, lng: 7.73 });
  });

  it('ne remplace pas une saisie manuelle par une localisation tardive', async () => {
    let success: any;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: vi.fn(callback => { success = callback; }),
    } });
    render(<HomeRideEstimator />);
    fireEvent.click(screen.getByRole('button', { name: 'Me localiser' }));
    fireEvent.change(screen.getByPlaceholderText('Point de départ'), { target: { value: 'Départ choisi' } });
    await act(async () => { await success({ coords: { latitude: 48.58, longitude: 7.73 } }); });
    expect(screen.getByPlaceholderText('Point de départ')).toHaveValue('Départ choisi');
  });

  it('permet une saisie manuelle si la localisation est refusée', () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: vi.fn((_success, error) => error({ code: 1 })),
    } });
    render(<HomeRideEstimator />);
    fireEvent.click(screen.getByRole('button', { name: 'Me localiser' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Autorisez la localisation ou saisissez votre départ');
    expect(screen.getByRole('button', { name: 'Me localiser' })).not.toBeDisabled();
  });

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
