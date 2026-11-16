import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { cameraBounds, camerasFromOverpass, mergeCameraAlerts } from '@/lib/vtc-speed-cameras';
import { createCameraService } from '@/lib/vtc-speed-cameras.server';
import { requireRadarReporter } from '@/lib/vtc-road-alerts.server';
import { RoadAlertButtons } from '@/components/driver/RoadAlertControls';
import { officialCameras, speedCameras as driverCameras, requireCameraReader } from '@/lib/vtc-driver-cameras.server';

const bbox = [7.71, 48.51, 7.79, 48.59];
const node = { type: 'node', id: 42, lat: 48.55, lon: 7.75, tags: { highway: 'speed_camera', maxspeed: '50' } };
const answer = () => new Response(JSON.stringify({ elements: [node] }));
afterEach(cleanup);

describe('source officielle disponible sans Overpass et accès chauffeur', () => {
  it('refuse les clients et autorise les chauffeurs côté serveur', () => {
    expect(() => requireCameraReader('rider')).toThrow('chauffeur');
    expect(() => requireCameraReader(undefined)).toThrow();
    expect(() => requireCameraReader('driver')).not.toThrow();
  });
  it('contient des radars officiels près de Strasbourg sans appel réseau', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    try {
      const cameras = await driverCameras([7.5, 48.4, 8, 48.8]);
      expect(cameras.source).toBe('official-fr');
      expect(cameras.cameras.length).toBeGreaterThan(0);
      expect(cameras.cameras.some((c: any) => c.id === 'fr:12112')).toBe(true);
      expect(network).not.toHaveBeenCalled();
      const empty = officialCameras([7.731, 48.581, 7.732, 48.582]);
      expect(empty.available).toBe(true);
      expect(empty.cameras.every(c => c.lat >= 48.5 && c.lat <= 48.6 && c.lng >= 7.7 && c.lng <= 7.8)).toBe(true);
    } finally { network.mockRestore(); }
  });
});

describe('radars Overpass', () => {
  it('borne les requêtes et refuse les zones trop larges ou injectées', () => {
    expect(cameraBounds(bbox)).toEqual([7.7, 48.5, 7.8, 48.6]);
    expect(() => cameraBounds('-180,-90,180,90')).toThrow();
    expect(() => cameraBounds('1,2,3,4);out;')).toThrow();
    expect(() => cameraBounds('')).toThrow();
  });
  it('ne conserve que les radars valides, sans doublons', () => {
    const cameras = camerasFromOverpass({ elements: [node, node, { ...node, id: 43, lat: 999 }, { ...node, id: 44, tags: { highway: 'bus_stop' } }] });
    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({ id: 'osm:node:42', lat: 48.55, lng: 7.75, kind: 'radar', source: 'osm', permanent: true, maxspeed: '50' });
    expect(() => camerasFromOverpass({ elements: [], remark: 'runtime error: timeout' })).toThrow();
    expect(mergeCameraAlerts([{ id: 'manual', kind: 'radar', lat: 48.55, lng: 7.75 }], cameras)).toHaveLength(1);
  });
  it('interroge highway=speed_camera et partage les requêtes simultanées et le cache', async () => {
    const fetcher = vi.fn(async () => answer());
    const load = createCameraService(fetcher);
    const [a, b] = await Promise.all([load(bbox), load(bbox)]);
    expect(a.cameras).toHaveLength(1);
    expect(b).toEqual(a);
    await load(bbox);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const request = fetcher.mock.calls[0] as any;
    expect(new URLSearchParams(request[1].body).get('data')).toContain('node["highway"="speed_camera"](48.5,7.7,48.6,7.8)');
  });
  it('conserve le cache périmé et temporise quand Overpass est indisponible', async () => {
    let clock = 0;
    const fetcher = vi.fn().mockImplementationOnce(async () => answer()).mockRejectedValue(new Error('offline'));
    const load = createCameraService(fetcher, () => clock);
    await load(bbox);
    clock = 7 * 3600_000;
    const result = await load(bbox);
    expect(result).toMatchObject({ available: false, stale: true });
    expect(result.cameras).toHaveLength(1);
    await load(bbox);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('ajout manuel réservé aux prioritaires', () => {
  it('vérifie le statut stocké côté serveur pour le chauffeur connecté', async () => {
    const chain: any = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: vi.fn(async () => ({ data: { is_priority: false } })) };
    const admin: any = { from: vi.fn(() => chain) };
    await expect(requireRadarReporter(admin, 'driver-id', 'radar')).rejects.toThrow('prioritaires');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'driver-id');
    chain.maybeSingle.mockResolvedValue({ data: { is_priority: true } });
    await expect(requireRadarReporter(admin, 'driver-id', 'radar')).resolves.toBeUndefined();
    chain.maybeSingle.mockResolvedValue({ data: null });
    await expect(requireRadarReporter(admin, 'driver-id', 'radar')).rejects.toThrow();
    await expect(requireRadarReporter(admin, 'driver-id', 'police')).resolves.toBeUndefined();
  });
  it('masque le bouton pour les chauffeurs ordinaires et conserve la police', () => {
    const props = { roadAlerts: { muted: false, toggleMute: vi.fn() }, reporting: null, onReport: vi.fn() };
    const { rerender } = render(<RoadAlertButtons {...props} />);
    expect(screen.queryByRole('button', { name: 'Signaler un radar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Signaler un contrôle de police' })).toBeTruthy();
    rerender(<RoadAlertButtons {...props} canReportRadar />);
    fireEvent.click(screen.getByRole('button', { name: 'Signaler un radar' }));
    expect(props.onReport).toHaveBeenCalledWith('radar');
  });
});
