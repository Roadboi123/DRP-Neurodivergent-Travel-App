import type { HttpClient } from '@/services/http-client';
import type { PreferenceResponse, SensitivityLevel } from '@/types/preference';

export interface SavePreferencesPayload {
  username: string;
  noise: SensitivityLevel | null;
  crowds: SensitivityLevel | null;
  temperature: SensitivityLevel | null;
  smell: SensitivityLevel | null;
  lights: SensitivityLevel | null;
}

export interface PreferencesService {
  /** Load a user's saved preferences. Returns `null` when none exist (HTTP 404). */
  getPreferences(username: string): Promise<PreferenceResponse | null>;
  /** Persist a user's preferences. Throws if the request fails. */
  savePreferences(payload: SavePreferencesPayload): Promise<void>;
}

/** Build a {@link PreferencesService} over an injected client. */
export function createPreferencesService(client: HttpClient): PreferencesService {
  return {
    async getPreferences(username) {
      // 404 (no saved preferences) is data, not an error — use the raw response.
      const res = await client.getResponse(`/preferences/${username.trim()}`);
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as PreferenceResponse;
    },

    async savePreferences(payload) {
      await client.post<void>('/preferences/', payload);
    },
  };
}
