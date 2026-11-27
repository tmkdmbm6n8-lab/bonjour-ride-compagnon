const ORIGIN = 'https://strasdrive.fr';

export class NetworkUnavailableError extends Error {
  constructor() {
    super('Veuillez vous reconnecter à Internet pour continuer.');
    this.name = 'NetworkUnavailableError';
  }
}

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super('Erreur serveur (' + status + ')');
    this.name = 'ApiError';
  }
}

// Transport only. Authentication must be wired to the verified server contract
// before private endpoints are used. Never automatically retry mutations.
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!path.startsWith('/api/') || path.includes('\\') || path.includes('..')) {
    throw new Error('Chemin API invalide');
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) abort();
  const timer = setTimeout(abort, 15000);
  try {
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    let response: Response;
    try {
      response = await fetch(ORIGIN + path, {
        ...options, headers, signal: controller.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new NetworkUnavailableError();
    }
    if (!response.ok) throw new ApiError(response.status);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
