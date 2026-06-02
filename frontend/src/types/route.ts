import type { components } from '@/types/generated/api';

/**
 * A route suggestion returned by `GET /routes/`.
 *
 * Generated from the backend Pydantic schema (`shared/openapi.json` → `npm run
 * gen:api`). Do not redefine these fields by hand — change the backend schema
 * and regenerate instead.
 */
export type RouteOption = components['schemas']['RouteOption'];

// Sensory intensity on a route: 1 = Low (Green), 2 = Med (Orange), 3 = High (Red).
export type SensoryLevel = RouteOption['noise'];

// Route classification surfaced in the UI.
export type RouteType = RouteOption['type'];

// Frontend-only: static data for the client-side warnings panel (not an API type).
export interface WarningItem {
  id: string;
  title: string;
  desc: string;
  severity: 'high' | 'medium' | 'info';
  icon: string;
}
