import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {Route} from '@/routes/index';

const state = vi.hoisted(() => ({native: true, status: 'loading', data: null as any}));
vi.mock('@capacitor/core', () => ({Capacitor: {isNativePlatform: () => state.native}}));
vi.mock('@/lib/archive-auth', () => ({useSession: () => state}));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: any) => ({options}),
  Navigate: ({to, replace}: any) => <div data-testid="destination" data-replace={String(replace)}>{to}</div>,
}));
vi.mock('@/lib/archive-navigation', () => ({default: ({children}: any) => <span>{children}</span>}));
vi.mock('@/components/shell/SiteHeader', () => ({default: () => <div>Public header</div>}));
vi.mock('@/components/shell/SiteFooter', () => ({default: () => null}));
vi.mock('@/components/home/HomeRideEstimator', () => ({default: () => null}));
const Home = Route.options.component as any;
afterEach(() => {cleanup(); state.native = true; state.status = 'loading'; state.data = null;});

it('waits for the restored session without displaying the public page', () => {
  const view = render(<Home />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByText('Public header')).not.toBeInTheDocument();
  state.status = 'authenticated';
  state.data = {user: {role: 'driver'}};
  view.rerender(<Home />);
  expect(screen.getByTestId('destination')).toHaveTextContent('/driver/dashboard');
  expect(screen.getByTestId('destination')).toHaveAttribute('data-replace', 'true');
});

it.each([['driver', '/driver/dashboard'], ['rider', '/dashboard'], ['admin', '/admin/dashboard']])('opens the native %s space', (role, destination) => {
  state.status = 'authenticated'; state.data = {user: {role}};
  render(<Home />);
  expect(screen.getByTestId('destination')).toHaveTextContent(destination);
});

it('keeps the public page available for signed-out native users', () => {
  state.status = 'unauthenticated';
  render(<Home />);
  expect(screen.getByText('Public header')).toBeInTheDocument();
});

it('keeps the website landing page available to signed-in visitors', () => {
  state.native = false; state.status = 'authenticated'; state.data = {user: {role: 'driver'}};
  render(<Home />);
  expect(screen.getByText('Public header')).toBeInTheDocument();
});
