import type { CapacitorConfig } from '@capacitor/cli';

// L'application tourne avec TanStack Start (SSR, fonctions serveur, dispatch),
// le conteneur mobile charge le site publié avec support complet iOS et Android.
const config: CapacitorConfig = {
  appId: 'fr.strasdrive.app',
  appName: 'StrasDrive',
  webDir: 'capacitor-shell',
  server: {
    url: 'https://bonjour-ride-compagnon.lovable.app',
    cleartext: false,
    androidScheme: 'https',
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
    scheme: 'StrasDrive',
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
};

export default config;
