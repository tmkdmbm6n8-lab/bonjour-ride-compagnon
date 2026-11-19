import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FavoriteDriverCard from '../components/private-clients/FavoriteDriverCard';
import PrivateClientsPanel from '../components/private-clients/PrivateClientsPanel';
import FavoriteRideChoice from '../components/private-clients/FavoriteRideChoice';

vi.mock('@/components/ui/bits', () => ({ Avatar: ({ name }) => <span>{name}</span> }));
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
    render(<PrivateClientsPanel clients={[]} loadQr={loadQr} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Code expiré')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByText('Code valide')).toBeTruthy());
    expect(screen.getByText('Vous n’avez pas encore de client privé.')).toBeTruthy();
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
