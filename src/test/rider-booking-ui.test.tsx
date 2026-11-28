import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route } from '@/routes/_authenticated.dashboard';
import { readRideDraft, saveRideDraft, clearRideDraft } from '@/lib/ride-draft';

const state = vi.hoisted(() => ({
  ride: null as any, phase: 'idle', vv: null as any,
  cancel: vi.fn(async () => {}), book: vi.fn(async () => {}), toast: vi.fn(),
}));
vi.mock('@/components/RiderLayout', () => ({ default: ({ children }: any) => children }));
vi.mock('@/components/ArchiveMap', () => ({ default: ({ userPosition }: any) => <div data-testid="map" data-user-lat={userPosition?.lat}>Carte</div> }));
vi.mock('@/components/ride/ChatSheet', () => ({ default: () => null }));
vi.mock('@/components/ride/MessageAlert', () => ({ default: () => null }));
vi.mock('@/components/payments/EmbeddedPayment', () => ({ default: () => null }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => state.toast }));
vi.mock('@/hooks/useLiveRoute', () => ({ useLiveRoute: () => null }));
vi.mock('@/hooks/useVisualViewport', () => ({ default: () => state.vv }));
vi.mock('@/lib/sounds', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/archive-navigation', () => ({ default: ({ href, children }: any) => <a href={href}>{children}</a> }));
vi.mock('@/hooks/useRiderRide', () => ({ default: () => ({
  phase: state.phase, ride: state.ride, loadingActive: false, cancel: state.cancel, book: state.book,
}) }));
vi.mock('@/lib/archive-fetch', () => ({ apiFetch: vi.fn(async (url: string) => {
  const data = url.includes('/geo/search') ? { results: [{ name: 'Gare', address: 'Gare Strasbourg', lat: 48.58, lng: 7.73 }] }
    : url.includes('/estimate') ? { route: { distanceMeters: 1000, durationSeconds: 300 }, estimates: { economy: { total: 12 } } }
    : url.includes('/nearby') ? { drivers: [], availability: {} }
    : { user: { wallet: { balance: 100 } } };
  return { ok: true, json: async () => data };
}) }));

const Dashboard = Route.options.component as any;
beforeEach(() => { state.phase = 'idle'; state.ride = null; state.vv = null; state.cancel.mockClear(); state.book.mockClear(); });
afterEach(() => { cleanup(); clearRideDraft(); vi.restoreAllMocks(); });

describe('réservation client', () => {
  it('reprend le trajet de l’accueil et calcule les tarifs sans commander automatiquement', async () => {
    saveRideDraft({
      pickup: { address: 'Gare Strasbourg', lat: 48.58, lng: 7.73 },
      dropoff: { address: 'Place Kléber', lat: 48.583, lng: 7.746 },
      pickupText: 'Gare Strasbourg', dropoffText: 'Place Kléber',
    });
    render(<Dashboard />);
    expect(screen.getByPlaceholderText('Lieu de prise en charge')).toHaveValue('Gare Strasbourg');
    expect(screen.getByPlaceholderText('Quelle est votre destination ?')).toHaveValue('Place Kléber');
    expect(await screen.findByRole('button', { name: 'Fermer les tarifs' })).toBeInTheDocument();
    expect(screen.getAllByText(/12,00/).length).toBeGreaterThan(0);
    expect(state.book).not.toHaveBeenCalled();
    expect(readRideDraft()).toBeNull();
  });

  it('affiche la position GPS au chargement sans remplacer le départ saisi', async () => {
    let success: any;
    const locate = vi.fn(callback => { success = callback; });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: locate } });
    render(<Dashboard />);
    const pickup = screen.getByPlaceholderText('Lieu de prise en charge');
    fireEvent.change(pickup, { target: { value: 'Mon adresse libre' } });
    await waitFor(() => expect(pickup).toHaveValue('Mon adresse libre'));
    expect(locate).toHaveBeenCalledTimes(1);
    act(() => success({ coords: { latitude: 48.57, longitude: 7.75 }, timestamp: Date.now() }));
    expect(screen.getByTestId('map')).toHaveAttribute('data-user-lat', '48.57');
    expect(pickup).toHaveValue('Mon adresse libre');
  });

  it('une localisation tardive ne remplace pas une adresse saisie entretemps', async () => {
    let success: any;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: vi.fn(callback => { success = callback; }),
    } });
    render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Me localiser' }));
    const pickup = screen.getByPlaceholderText('Lieu de prise en charge');
    fireEvent.change(pickup, { target: { value: 'Départ choisi' } });
    await act(async () => { await success({ coords: { latitude: 48, longitude: 7 } }); });
    expect(pickup).toHaveValue('Départ choisi');
  });

  it('garde le panneau ancré par le bas quand le clavier apparaît', async () => {
    state.vv = { top: 0, height: 400 };
    render(<Dashboard />);
    fireEvent.focus(screen.getByPlaceholderText('Lieu de prise en charge'));
    const panel = screen.getByPlaceholderText('Lieu de prise en charge').closest('.ride-panel') as HTMLElement;
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.bottom).not.toBe('auto');
    expect(panel.style.bottom).not.toBe('');
    await act(async () => {});
  });

  it('propose les paiements et permet de quitter les tarifs sans réserver', async () => {
    render(<Dashboard />);
    for (const placeholder of ['Lieu de prise en charge', 'Quelle est votre destination ?']) {
      const input = screen.getByPlaceholderText(placeholder);
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'gare' } });
      fireEvent.click(await screen.findByRole('option'));
      fireEvent.blur(input);
    }
    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveClass('rider-payment-option');
    fireEvent.click(screen.getByRole('radio', { name: /Carte/ }));
    expect(screen.getByRole('radio', { name: /Carte/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer les tarifs' }));
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fermer les tarifs' })).toBeNull();
    expect(screen.getByPlaceholderText('Lieu de prise en charge')).toHaveValue('Gare Strasbourg');
    expect(screen.getByPlaceholderText('Quelle est votre destination ?')).toHaveValue('');
    expect(state.book).not.toHaveBeenCalled();
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it('rend l’annulation accessible avant la prise en charge et demande confirmation', async () => {
    state.phase = 'active';
    state.ride = { id: 'ride-1', status: 'accepted', pickup: { lat: 48, lng: 7, address: 'Départ' },
      dropoff: { lat: 49, lng: 8, address: 'Arrivée' }, fare: { total: 12 }, driver: null };
    render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler la course' }));
    expect(state.cancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler sans motif' }));
    await waitFor(() => expect(state.cancel).toHaveBeenCalledWith(''));
  });
});
