import type { HttpClient } from '@/services/http-client';
import type { PresetsPayload, PresetsResponse } from '@/types/preset';

export interface PresetsService {
  /** Load a user's preset profiles. Returns `null` when none exist (HTTP 404). */
  getPresets(username: string): Promise<PresetsResponse | null>;
  /** Replace a user's preset profiles + active selection. Returns the saved set. */
  savePresets(payload: PresetsPayload): Promise<PresetsResponse>;
}

/** Build a {@link PresetsService} over an injected client. */
export function createPresetsService(client: HttpClient): PresetsService {
  return {
    async getPresets(username) {
      // 404 (no saved presets) is data, not an error — use the raw response.
      const res = await client.getResponse(`/presets/${username.trim()}`);
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as PresetsResponse;
    },

    savePresets(payload) {
      return client.post<PresetsResponse>('/presets/', payload);
    },
  };
}
