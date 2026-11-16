import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Route } from '@/routes/login';
import { clearRideDraft, readRideDraft, saveRideDraft } from '@/lib/ride-draft';

const state = vi.hoisted(() => ({ push: vi.fn(), update: vi.fn(async () => ({})) }));
vi.mock('@/lib/archive-auth', () => ({
  signIn: vi.fn(async () => ({ ok: true })),
  useSession: () => ({ update: state.update }),
}));
vi.mock('@/lib/archive-fetch', () => ({ apiFetch: vi.fn(async () => ({ json: async () => ({ user: { role: 'rider' } }) })) }));
vi.mock('@/lib/archive-navigation', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: state.push }),
}));
afterEach(clearRideDraft);

it('connecte puis ouvre la réservation sans recharger et sans perdre le trajet temporaire', async () => {
  saveRideDraft({ pickup: null, dropoff: null, pickupText: 'Gare', dropoffText: 'Centre' });
  const Component = Route.options.component as React.ComponentType;
  render(<Component />);
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'alex@example.fr' } });
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'SecurePass123!' } });
  fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }));
  await waitFor(() => expect(state.push).toHaveBeenCalledWith('/dashboard'));
  expect(state.update).toHaveBeenCalled();
  expect(readRideDraft()?.pickupText).toBe('Gare');
  expect(readRideDraft()?.dropoffText).toBe('Centre');
});
