import type { CapacitorConfig } from '@capacitor/cli';

// L'application tourne avec TanStack Start (SSR, fonctions serveur, dispatch),
// le conteneur mobile charge le site publié avec support complet iOS et Android.
const config: CapacitorConfig = {
  appId: 'fr.strasdrive.app',
  appName: 'StrasDrive',
  webDir: 'capacitor-shell',
  server: {
    url: 'https://strasdrive.fr',
    cleartext: false,
    androidScheme: 'https',
    errorPath: 'offline.html',
  },
  android: {
    backgroundColor: '#0e0f12',
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
    scheme: 'StrasDrive',
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
};

export default config;
