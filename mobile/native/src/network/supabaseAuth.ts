import type {Session} from './session';

export interface PublicAuthConfig {
  url: string;
  publishableKey: string;
}

export class SupabaseAuth {
  constructor(private readonly config: PublicAuthConfig) {
    if (!/^https:\/\/[^/]+\/?$/.test(config.url) ||
        !config.publishableKey || config.publishableKey.startsWith('sb_secret_')) {
      throw new Error('Configuration publique Supabase invalide');
    }
  }

  private async token(grant: 'password' | 'refresh_token', body: Record<string, string>): Promise<Session> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(this.config.url.replace(/\/$/, '') + '/auth/v1/token?grant_type=' + grant, {
        method: 'POST',
        headers: {'apikey': this.config.publishableKey, 'Content-Type': 'application/json'},
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 400 && grant === 'password'
        ? 'Identifiant ou mot de passe incorrect' : 'Authentification indisponible');
      const data = await response.json();
      if (!data.user?.id || !data.access_token || !data.refresh_token || !Number.isFinite(data.expires_in)) {
        throw new Error('Session invalide');
      }
      return {accountId: data.user.id, accessToken: data.access_token,
        refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000};
    } finally { clearTimeout(timer); }
  }

  signIn(email: string, password: string): Promise<Session> {
    return this.token('password', {email: email.trim(), password});
  }

  async refresh(session: Session): Promise<Session> {
    const next = await this.token('refresh_token', {refresh_token: session.refreshToken});
    if (next.accountId !== session.accountId) throw new Error('Identité de session invalide');
    return next;
  }
}
