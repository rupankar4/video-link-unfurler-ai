import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.7343d6fb8cdc48a58c6c85218afc48af',
  appName: 'video-link-unfurler-ai',
  webDir: 'dist',
  server: {
    url: 'https://7343d6fb-8cdc-48a5-8c6c-85218afc48af.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1a1a1a",
      showSpinner: false
    }
  }
};

export default config;