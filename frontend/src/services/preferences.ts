import { apiUrl } from '@/services/api-client';
import type { PreferenceResponse, SensitivityLevel } from '@/types/preference';

export interface SavePreferencesPayload {
  username: string;
  noise: SensitivityLevel | null;
  crowds: SensitivityLevel | null;
  temperature: SensitivityLevel | null;
  smell: SensitivityLevel | null;
  lights: SensitivityLevel | null;
}

/** Load a user's saved preferences. Returns `null` when none exist (HTTP 404). */
export async function getPreferences(
  username: string
): Promise<PreferenceResponse | null> {
  const res = await fetch(apiUrl(`/preferences/${username.trim()}`));
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as PreferenceResponse;
}

/** Persist a user's preferences. Throws if the request fails. */
export async function savePreferences(
  payload: SavePreferencesPayload
): Promise<void> {
  const res = await fetch(apiUrl('/preferences/'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('Failed to save preferences');
  }
}
