import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import AdminRideMap from '@/components/admin/AdminRideMap';
vi.mock('@/components/ArchiveMap', () => ({ default: () => <div>Carte chargée</div> }));
afterEach(cleanup);
describe('carte du dossier administrateur', () => {
  const pickup = { lat: 48.58, lng: 7.75 };
  const dropoff = { lat: 48.57, lng: 7.76 };
  it('montre la carte lorsque les deux positions sont disponibles', () => {
    render(<AdminRideMap pickup={pickup} dropoff={dropoff} />);
    expect(screen.getByText('Carte chargée')).toBeTruthy();
  });
  it('ne montre jamais les coordonnées effacées ou manquantes', () => {
    const view = render(<AdminRideMap pickup={pickup} dropoff={dropoff} erased />);
    expect(screen.queryByText('Carte chargée')).toBeNull();
    view.rerender(<AdminRideMap pickup={pickup} dropoff={{ lat: null, lng: null }} />);
    expect(screen.queryByText('Carte chargée')).toBeNull();
  });
});
