import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GameStore Studio',
  slug: 'gamestore-studio',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'gamestorestudio',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.gamestorestudio.mobile',
  },
  android: {
    package: 'app.gamestorestudio.mobile',
    versionCode: 1,
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#17132B',
      monochromeImage: './assets/images/monochrome.png',
    },
    blockedPermissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.READ_CONTACTS',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.VIBRATE',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: {
    bundler: 'metro',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    'expo-image',
    'expo-sharing',
    'expo-video',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#17132B',
        image: './assets/images/splash-icon.png',
        imageWidth: 180,
        dark: {
          backgroundColor: '#0E0C16',
          image: './assets/images/splash-icon.png',
        },
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'O GameStore Studio acessa suas fotos apenas quando você envia capas e capturas dos seus jogos.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    './plugins/withAndroidReleaseSigning',
  ],
  extra: {
    privacyContactEmail: process.env.EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL ?? '',
  },
});
