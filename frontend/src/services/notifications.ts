import * as Notifications from 'expo-notifications';
import { Image, Platform } from 'react-native';
import { analytics } from '@/services/analytics';

// The Clearway logo, used as the web notification icon. (Native uses the icon
// configured in app.json's expo-notifications plugin.) `resolveAssetSource` is
// absent in some environments (notably expo-router's web static/SSR render),
// where calling it throws at module load and 500s the whole page — guard it so
// importing this module (and everything that depends on it) can never crash.
const CLEARWAY_LOGO = require('../../assets/images/clearway-logo.png');
const LOGO_URI: string | undefined =
  typeof Image.resolveAssetSource === 'function'
    ? Image.resolveAssetSource(CLEARWAY_LOGO)?.uri
    : undefined;

// Configure notification behavior for mobile devices
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions for web or mobile.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await window.Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

/**
 * Send a local push notification immediately.
 */
export async function sendLocalNotification(title: string, body: string): Promise<void> {
  console.log(`[Notifications Service] Dispatching notification: "${title}" - "${body}"`);

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (window.Notification.permission === 'granted') {
        const notification = new window.Notification(title, { body, icon: LOGO_URI });
        notification.onclick = () => {
          window.focus();
          console.log('[Web Notification] Notification clicked (tap)');
          analytics.trackWarningInteraction();
        };
        return;
      }
    }
    // Fallback if permission is denied or Web Notification API is unsupported
    console.log(`[Web Notification Fallback] ${title}: ${body}`);
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null, // Deliver immediately
  });
}
