import type { RouteOption } from '@/types/route';

let activeJourneyRoute: RouteOption | null = null;

export function setActiveJourneyRoute(route: RouteOption) {
  activeJourneyRoute = route;
}

export function getActiveJourneyRoute() {
  return activeJourneyRoute;
}

// One-shot flag: set when the user backs out of an active journey so the routes
// screen knows to re-open the details sheet they saw before pressing "Go",
// rather than dropping them on the bare routes list.
let reopenDetailsPending = false;

export function requestReopenJourneyDetails() {
  reopenDetailsPending = true;
}

export function consumeReopenJourneyDetails() {
  const pending = reopenDetailsPending;
  reopenDetailsPending = false;
  return pending;
}
