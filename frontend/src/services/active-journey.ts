import type { RouteOption } from '@/types/route';

let activeJourneyRoute: RouteOption | null = null;

export function setActiveJourneyRoute(route: RouteOption) {
  activeJourneyRoute = route;
}

export function getActiveJourneyRoute() {
  return activeJourneyRoute;
}
