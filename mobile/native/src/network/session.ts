import {apiRequest, ApiError} from './api';
import {secureStorage} from '../storage/secureStorage';

export interface Session {
  accountId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
export interface LiveAccount {
  role: string;
  canDrive: boolean;
  suspended: boolean;
}

export async function authenticatedRequest<T>(session: Session, path: string, options: RequestInit = {}): Promise<T> {
  if (session.expiresAt <= Date.now()) throw new ApiError(401);
  const headers = new Headers(options.headers);
  headers.set('Authorization', 'Bearer ' + session.accessToken);
  return apiRequest<T>(path, {...options, headers});
}

export async function validateSession(session: Session): Promise<LiveAccount> {
  const account = await authenticatedRequest<LiveAccount>(session, '/api/users/me/live');
  if (typeof account.suspended !== 'boolean' || typeof account.role !== 'string') {
    throw new Error('Réponse de session invalide');
  }
  if (account.suspended) {
    await secureStorage.purgeAccount(session.accountId);
    throw new Error('Compte suspendu');
  }
  return account;
}

// Call only after authentication and identity verification by the backend.
export async function persistVerifiedSession(session: Session): Promise<void> {
  await validateSession(session);
  await secureStorage.write(session.accountId, 'auth-session', JSON.stringify(session));
}

export async function clearLocalSession(accountId: string): Promise<void> {
  await secureStorage.purgeAccount(accountId);
}
