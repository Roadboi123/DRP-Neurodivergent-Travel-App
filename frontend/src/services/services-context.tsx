import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createApiClient, createLocalApiClient } from '@/services/client-config';
import { createFallbackClient } from '@/services/fallback-client';
import { createHealthService, type HealthService } from '@/services/health';
import {
  createPreferencesService,
  type PreferencesService,
} from '@/services/preferences';
import { createRoutesService, type RoutesService } from '@/services/routes';

export interface Services {
  routes: RoutesService;
  preferences: PreferencesService;
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

  return {
    routes: createRoutesService(createFallbackClient(api, local)),
    preferences: createPreferencesService(api),
    health: createHealthService(api),
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
export const useHealthService = (): HealthService => useServices().health;
