import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eaglegym.app',
  appName: 'Eagle Gym',
  webDir: '../public',
  server: {
    url: 'https://eagles-backend-fu2p.onrender.com',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
