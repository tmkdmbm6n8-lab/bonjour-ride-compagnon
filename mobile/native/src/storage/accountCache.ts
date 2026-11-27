// Adapter must provide encrypted storage backed by platform-protected keys.
// No plaintext fallback is permitted.
export interface EncryptedAccountStorage {
  read(accountId: string, key: string): Promise<string | null>;
  write(accountId: string, key: string, value: string): Promise<void>;
  purgeAccount(accountId: string): Promise<void>;
}

export type OfflineCollection =
  | 'profile' | 'rides' | 'invoices' | 'documents'
  | 'earnings' | 'reservations' | 'favorites' | 'wallet';

export class AccountCache {
  private active = true;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly storage: EncryptedAccountStorage,
    private readonly accountId: string,
  ) {
    if (!accountId.trim()) throw new Error('Compte requis');
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.active) return Promise.reject(new Error('Session fermée'));
    const result = this.pending.then(() => {
      if (!this.active) throw new Error('Session fermée');
      return operation();
    });
    this.pending = result.catch(() => undefined);
    return result;
  }

  read<T>(collection: OfflineCollection): Promise<T | null> {
    return this.enqueue(async () => {
      const value = await this.storage.read(this.accountId, collection);
      return value === null ? null : JSON.parse(value) as T;
    });
  }

  // Only call with server-authorized, explicitly selected read models.
  // Never store payment credentials, access tokens or server secrets here.
  save<T>(collection: OfflineCollection, value: T): Promise<void> {
    return this.enqueue(() =>
      this.storage.write(this.accountId, collection, JSON.stringify(value)),
    );
  }

  async closeAndPurge(): Promise<void> {
    this.active = false;
    await this.pending;
    await this.storage.purgeAccount(this.accountId);
  }
}
