import { Platform } from 'react-native';

/**
 * Global API Base URL configuration.
 * 
 * For local development:
 * - iOS Simulator / Web: 'localhost'
 * - Android Emulator: '10.0.2.2' (points to the host machine's localhost)
 * - Physical device (Expo Go): Replace with your computer's local IP address (e.g., '192.168.1.150')
 */
const LOCAL_HOST = Platform.select({
  android: '10.0.2.2',
  default: 'localhost',
});

// DEFAULT: Local backend server
export const API_BASE_URL = `http://${LOCAL_HOST}:8000`;

// To switch back to the Railway production server, uncomment the line below and comment out the local one:
// export const API_BASE_URL = 'https://drp-neurodivergent-travel-app-production.up.railway.app';
