import {apiRequest} from '../src/network/api';

const originalFetch = global.fetch;
const token = 'header.payload.signature';

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe('transport de la passerelle native', () => {
  it('conserve le chemin métier derrière la passerelle externe', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ok: true, json: async () => ({ok: true})});
    global.fetch = fetchMock as typeof fetch;

    await apiRequest('/api/users/me/live?view=rider', {
      headers: {Authorization: `Bearer ${token}`},
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://strasdrive.fr/api/public/native/users/me/live?view=rider',
      expect.objectContaining({headers: expect.any(Headers)}),
    );
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect((options.headers as Headers).get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('déclare automatiquement les corps JSON', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ok: true, json: async () => ({ok: true})});
    global.fetch = fetchMock as typeof fetch;

    await apiRequest('/api/drivers/location', {
      method: 'POST',
      body: JSON.stringify({lat: 48.58}),
    });

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect((options.headers as Headers).get('Content-Type')).toBe('application/json');
  });
});
