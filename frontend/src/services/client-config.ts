import { API_BASE_URL, LOCAL_API_BASE_URL } from '@/constants/config';
import { createHttpClient, type HttpClient } from '@/services/http-client';

/**
 * Endpoint selection lives here and nowhere else: these factories are the only
 * code that maps a configured URL (from `constants/config.ts`) to a client.
 * Pointing a service at a different backend is a change in one place.
 */

/** Client for the configured (deployed) backend. */
export const createApiClient = (): HttpClient =>
  createHttpClient({ baseUrl: API_BASE_URL });

/** Client for the local FastAPI fallback backend. */
export const createLocalApiClient = (): HttpClient =>
  createHttpClient({ baseUrl: LOCAL_API_BASE_URL });
