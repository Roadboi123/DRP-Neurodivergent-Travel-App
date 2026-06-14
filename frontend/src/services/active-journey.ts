import type { RouteOption } from '@/types/route';

let activeJourneyRoute: RouteOption | null = null;

export function setActiveJourneyRoute(route: RouteOption) {
  activeJourneyRoute = route;
}

export function getActiveJourneyRoute() {
  return activeJourneyRoute;
}

// The human labels the traveller typed for this journey (e.g. "Westfield
// London", "Current Location"). Used as friendly fallbacks when a leg's
// departure/arrival is only a raw coordinate, so the timeline reads e.g.
// "Walk to Westfield London" instead of "Walk to your destination".
let activeJourneyOriginLabel = '';
let activeJourneyDestinationLabel = '';

export function setActiveJourneyLabels(origin: string, destination: string) {
  activeJourneyOriginLabel = origin;
  activeJourneyDestinationLabel = destination;
}

export function getActiveJourneyLabels() {
  return { origin: activeJourneyOriginLabel, destination: activeJourneyDestinationLabel };
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
