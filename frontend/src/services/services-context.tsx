import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createApiClient, createLocalApiClient } from '@/services/client-config';
import { createFallbackClient } from '@/services/fallback-client';
import { createHealthService, type HealthService } from '@/services/health';
import {
  createPreferencesService,
  type PreferencesService,
} from '@/services/preferences';
import { createPresetsService, type PresetsService } from '@/services/presets';
import { createRoutesService, type RoutesService } from '@/services/routes';

export interface Services {
  routes: RoutesService;
  preferences: PreferencesService;
  presets: PresetsService;
  health: HealthService;
}

/**
 * The composition root: the single place that wires clients to services and
 * decides which service gets failover. Repointing every service at a different
 * backend (or giving another service the fallback client) is a change here only.
 */
function createDefaultServices(): Services {
  const api = createApiClient();
  const local = createLocalApiClient();

  // In development, prioritize local backend so changes are tested. In production, use the deployed API.
  const routesClient = __DEV__ ? createFallbackClient(local, api) : createFallbackClient(api, local);
  const preferencesClient = __DEV__ ? createFallbackClient(local, api) : api;
  const presetsClient = __DEV__ ? createFallbackClient(local, api) : api;
  const healthClient = __DEV__ ? createFallbackClient(local, api) : api;

  return {
    routes: createRoutesService(routesClient),
    preferences: createPreferencesService(preferencesClient),
    presets: createPresetsService(presetsClient),
    health: createHealthService(healthClient),
  };
}


const ServicesContext = createContext<Services | null>(null);

interface ServicesProviderProps {
  children: ReactNode;
  /** Override the wired services — the seam for tests/storybook to inject mocks. */
  value?: Services;
}

export function ServicesProvider({ children, value }: ServicesProviderProps) {
  // Construct once for the app lifetime (or whenever an override is supplied).
  const services = useMemo(() => value ?? createDefaultServices(), [value]);

  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error('useServices must be used within a ServicesProvider');
  }
  return services;
}

export const useRoutesService = (): RoutesService => useServices().routes;
export const usePreferencesService = (): PreferencesService => useServices().preferences;
export const usePresetsService = (): PresetsService => useServices().presets;
export const useHealthService = (): HealthService => useServices().health;
