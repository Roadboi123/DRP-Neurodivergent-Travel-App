import type { components } from '@/types/generated/api';

/**
 * Preset-profile contract types, generated from the backend Pydantic schemas
 * (`shared/openapi.json` → `npm run gen:api`). Do not redefine by hand — change
 * the backend schema and regenerate instead.
 */

/** A single saved preset profile: a name plus a full sensitivity set. */
export type Preset = components['schemas']['Preset'];

/** Response body for `GET /presets/{username}`. */
export type PresetsResponse = components['schemas']['PresetsResponse'];

/** Request body for `POST /presets/`. */
export type PresetsPayload = components['schemas']['PresetsPayload'];

/** Preset slot identifier (`'p1' | 'p2' | 'p3'`). */
export type PresetId = Preset['id'];
