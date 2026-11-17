import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { driverReportMessage } from '@/lib/driver-reports';
import { assertRideActionMethod } from '@/lib/vtc-access';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/archive-fetch', () => ({ apiFetch: mocks.fetch }));
import ReportDriverButton from '@/components/ride/ReportDriverButton';
const ride = { id: 'ride-1', rider_id: 'rider', driver_id: 'driver' };
beforeEach(() => mocks.fetch.mockReset());
afterEach(cleanup);
describe('signalements chauffeur', () => {
  it('lie le signalement aux participants réels de la course', () => {
    const message = driverReportMessage(ride, 'rider', { reason: 'harassment', details: 'Mon commentaire' });
    expect(message).toContain('course ride-1');
    expect(message).toContain('Chauffeur : driver');
    expect(message).toContain('Harcèlement');
    expect(message).toContain('Mon commentaire');
  });
  it('refuse les tiers, le chauffeur et une course non attribuée', () => {
    for (const uid of ['stranger', 'driver']) expect(() => driverReportMessage(ride, uid, { reason: 'other', details: 'Un commentaire' })).toThrow();
    expect(() => driverReportMessage({ ...ride, driver_id: null }, 'rider', { reason: 'aggression' })).toThrow();
    expect(() => assertRideActionMethod('report', 'GET')).toThrow();
  });
  it('valide le motif et exige des précisions pour Autre', () => {
    expect(() => driverReportMessage(ride, 'rider', { reason: 'unknown' })).toThrow();
    expect(() => driverReportMessage(ride, 'rider', { reason: 'other', details: 'court' })).toThrow();
    expect(() => driverReportMessage(ride, 'rider', { reason: 'aggression', details: 'x'.repeat(2001) })).toThrow();
  });
  it('envoie le motif et les précisions puis affiche la confirmation réelle', async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    render(<ReportDriverButton ride={ride} />);
    fireEvent.click(screen.getByRole('button', { name: 'Signaler le chauffeur' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Autre' }));
    expect(screen.getByRole('button', { name: 'Envoyer le signalement' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Précisez votre signalement (obligatoire)'), { target: { value: 'Un problème à examiner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('envoyé'));
    expect(mocks.fetch).toHaveBeenCalledWith('/api/rides/ride-1/report', expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'other', details: 'Un problème à examiner' }) }));
  });
  it('conserve le formulaire et les précisions si l’envoi échoue', async () => {
    mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Envoi impossible' }) });
    render(<ReportDriverButton ride={ride} />);
    fireEvent.click(screen.getByRole('button', { name: 'Signaler le chauffeur' }));
    fireEvent.click(screen.getByRole('radio', { name: /Conduite dangereuse/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Envoi impossible'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Envoyer le signalement' })).toBeEnabled();
  });
});
