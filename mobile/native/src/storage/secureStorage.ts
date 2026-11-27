import {NativeModules} from 'react-native';
import type {EncryptedAccountStorage} from './accountCache';

interface NativeEncryptedStorage {
  read(accountId: string, key: string): Promise<string | null>;
  write(accountId: string, key: string, value: string): Promise<void>;
  purgeAccount(accountId: string): Promise<void>;
}

function nativeStorage(): NativeEncryptedStorage {
  const module = NativeModules.StrasDriveEncryptedStorage as NativeEncryptedStorage | undefined;
  if (!module || typeof module.read !== 'function' ||
      typeof module.write !== 'function' || typeof module.purgeAccount !== 'function') {
    throw new Error('Stockage sécurisé indisponible');
  }
  return module;
}

// No plaintext fallback. The platform implementation must authenticate
// encrypted records, isolate accounts and exclude sensitive files from backups.
export const secureStorage: EncryptedAccountStorage = {
  async read(accountId, key) {
    return nativeStorage().read(accountId, key);
  },
  async write(accountId, key, value) {
    await nativeStorage().write(accountId, key, value);
  },
  async purgeAccount(accountId) {
    await nativeStorage().purgeAccount(accountId);
  },
};
