import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route } from '@/routes/signup';

const { signup, signIn } = vi.hoisted(() => ({ signup: vi.fn(), signIn: vi.fn() }));
vi.mock('@/lib/archive-fetch', () => ({ apiFetch: signup }));
vi.mock('@/lib/archive-auth', () => ({ signIn, useSession: () => ({ update: vi.fn() }) }));
vi.mock('@/lib/archive-navigation', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

describe('Signup email confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signup.mockResolvedValue({ ok: true, json: async () => ({ needsConfirmation: true }) });
  });

  async function submit(email: string) {
    const Component = Route.options.component as React.ComponentType;
    render(<Component />);
    fireEvent.change(screen.getByLabelText('Nom d’utilisateur'), { target: { value: 'alexmartin' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'SecurePass123!' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Créer un compte/ }));
    await screen.findByRole('heading', { name: 'Vérifiez votre adresse email' });
  }

  it('replaces the form with a success screen and the matching mailbox', async () => {
    await submit('alex@gmail.com');
    expect(screen.getByRole('status')).toHaveTextContent('Inscription réussie');
    expect(screen.getByText('alex@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ouvrir ma messagerie/ })).toHaveAttribute('href', 'https://mail.google.com/');
    expect(document.querySelector('.input-error-msg')).toBeNull();
    expect(screen.queryByLabelText('Mot de passe')).not.toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('heading')).toHaveFocus());
  });

  it('explains confirmation without inventing a mailbox for an unknown provider', async () => {
    await submit('alex@entreprise.fr');
    expect(screen.queryByRole('link', { name: /Ouvrir ma messagerie/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Se connecter après confirmation/ })).toHaveAttribute('href', '/login');
  });
});
