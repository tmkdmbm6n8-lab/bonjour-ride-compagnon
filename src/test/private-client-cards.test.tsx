// @ts-nocheck
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FavoriteDriverCard from '../components/private-clients/FavoriteDriverCard';
import PrivateClientsPanel from '../components/private-clients/PrivateClientsPanel';
import FavoriteRideChoice from '../components/private-clients/FavoriteRideChoice';

vi.mock('@/components/ui/bits', () => ({ Avatar: ({ name }) => <span>{name}</span>, VEHICLE_LABELS: { economy: 'StrasDrive Go' }, money: (n) => String(n) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('clients privés', () => {
  it('demande confirmation avant de retirer le chauffeur et signale les erreurs', async () => {
    const remove = vi.fn().mockRejectedValue(new Error('Réessayez plus tard'));
    render(<FavoriteDriverCard driver={{ name: 'Alex', completedTogether: 2 }} onRemove={remove} />);
    expect(screen.getByText('2 courses ensemble')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer des favoris' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Réessayez plus tard');
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('ne présente pas un QR expiré et permet de réessayer', async () => {
    const loadQr = vi.fn().mockResolvedValueOnce({ image: <span>Code expiré</span>, expiresAt: Date.now() - 1 }).mockResolvedValueOnce({ image: <span>Code valide</span>, expiresAt: Date.now() + 60000 });
    render(<PrivateClientsPanel clients={[]} loadQr={loadQr} goldActive />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Code expiré')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByText('Code valide')).toBeTruthy());
    expect(screen.getByText('Vous n’avez pas encore de client privé.')).toBeTruthy();
  });

  it('conserve les clients et masque le QR lorsque Gold devient inactif', async () => {
    const loadQr = vi.fn().mockResolvedValue({ image: <span>Code Gold</span>, expiresAt: Date.now() + 60000 });
    const clients = [{ id: 'client', name: 'Camille' }];
    const { rerender } = render(<PrivateClientsPanel clients={clients} loadQr={loadQr} goldActive={false} />);
    expect(screen.getByRole('list')).toHaveClass('private-clients-list-inactive');
    expect(loadQr).not.toHaveBeenCalled();
    rerender(<PrivateClientsPanel clients={clients} loadQr={loadQr} goldActive />);
    expect(await screen.findByText('Code Gold')).toBeTruthy();
    rerender(<PrivateClientsPanel clients={clients} loadQr={loadQr} goldActive={false} />);
    expect(screen.queryByText('Code Gold')).toBeNull();
    expect(screen.getByRole('list')).toHaveTextContent('Camille');
  });

  it('demande confirmation avant de remplacer un favori existant', async () => {
    const save = vi.fn().mockResolvedValueOnce({ requiresConfirmation: true, previousDriverId: 'ancien' }).mockResolvedValueOnce({ ok: true });
    render(<FavoriteRideChoice driver={{ id: 'nouveau', name: 'Alex' }} onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mettre ce chauffeur en favori' }));
    expect(await screen.findByText(/Vous avez déjà un chauffeur favori/)).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le changement' }));
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(save).toHaveBeenLastCalledWith('nouveau', { confirmReplacement: true, expectedDriverId: 'ancien' });
  });
});

describe('chauffeur favori en tête du comparateur', () => {
  it('affiche le temps d’arrivée du favori disponible et permet de le choisir', async () => {
    const { default: FavoriteQuoteRow } = await import('../components/private-clients/FavoriteQuoteRow');
    const select = vi.fn();
    render(<FavoriteQuoteRow favorite={{ name: 'Alex', status: 'available', etaMinutes: 6, vehicleType: 'economy', fare: { total: 18.5 } }} selected={false} onSelect={select} />);
    expect(screen.getByText('Arrive dans 6 min')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('un favori en course ne peut pas être choisi', async () => {
    const { default: FavoriteQuoteRow } = await import('../components/private-clients/FavoriteQuoteRow');
    const select = vi.fn();
    render(<FavoriteQuoteRow favorite={{ name: 'Alex', status: 'busy', etaMinutes: null, vehicleType: 'economy', fare: { total: 18.5 } }} selected={false} onSelect={select} />);
    expect(screen.getByText('En course en ce moment')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(select).not.toHaveBeenCalled();
  });
});
