import type { CapacitorConfig } from '@capacitor/cli';

// The app runs server functions (SSR, payments, dispatch), so the Android
// shell loads the published site instead of a static bundle. `dist` has no
// index.html with TanStack Start, which caused the blank "test" screen.
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
};

export default config;
