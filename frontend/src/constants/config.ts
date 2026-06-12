/**
 * Runtime configuration.
 *
 * `EXPO_PUBLIC_API_URL` is inlined at build time by Expo. When unset (e.g. local
 * development without a .env), it falls back to the deployed Railway backend so
 * the app keeps working out of the box.
 */

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  'https://drp-neurodivergent-travel-app-production.up.railway.app';

/**
 * Local FastAPI instance used as a fallback when the deployed backend is
 * unreachable. Override via `EXPO_PUBLIC_LOCAL_API_URL` (e.g. on a physical
 * device, where `localhost` is the phone, not the dev machine).
 */
export const LOCAL_API_BASE_URL =
  process.env.EXPO_PUBLIC_LOCAL_API_URL ?? 'http://localhost:8000';
