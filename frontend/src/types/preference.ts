import type { components } from '@/types/generated/api';

/**
 * Response body for `GET /preferences/{username}`.
 *
 * Generated from the backend Pydantic schema (`shared/openapi.json` → `npm run
 * gen:api`). Do not redefine these fields by hand — change the backend schema
 * and regenerate instead.
 */
export type PreferenceResponse = components['schemas']['PreferenceResponse'];

// Accepted sensitivity labels. Derived from the (non-nullable) request body.
export type SensitivityLevel = components['schemas']['SensitivityPreferences']['noise'];

// Frontend-only UI model for a single preferences-screen row.
export interface Preference {
  id: string;
  label: string;
  emoji: string;
  value: SensitivityLevel | null;
}
