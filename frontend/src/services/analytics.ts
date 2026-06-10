// Read API URL from environment, fallback to localhost
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

class AnalyticsService {
  private destinationSearchTime: number | null = null;
  private clickCount: number = 0;
  private screenChangeCount: number = 0;
  private originalRouteId: string | null = null;
  private chosenRouteId: string | null = null;
  private warningsSeen: boolean = false;
  private warningClickedForInfo: boolean = false;
  
  // Active journey stats
  private appAccessesDuringJourney: number = 0;
  private isJourneyActive: boolean = false;
  
  // Disruption report stats
  private reportOpenTime: number | null = null;

  startSearch(startName: string, endName: string) {
    this.destinationSearchTime = Date.now();
    this.clickCount = 0;
    this.screenChangeCount = 0;
    this.originalRouteId = null;
    this.chosenRouteId = null;
    this.warningsSeen = false;
    this.warningClickedForInfo = false;
    console.log('[Analytics] Search started. Tracking initialized.');
  }

  trackClick() {
    this.clickCount += 1;
    console.log(`[Analytics] Tracked click. Total timeframe clicks: ${this.clickCount}`);
  }

  trackScreenChange() {
    this.screenChangeCount += 1;
    console.log(`[Analytics] Tracked screen change. Total screen changes: ${this.screenChangeCount}`);
  }

  trackRouteView(routeId: string, hasWarnings: boolean) {
    if (!this.originalRouteId) {
      this.originalRouteId = routeId;
    }
    this.chosenRouteId = routeId;
    if (hasWarnings) {
      this.warningsSeen = true;
    }
    console.log(`[Analytics] Route viewed. originalRouteId=${this.originalRouteId}, chosenRouteId=${this.chosenRouteId}, hasWarnings=${hasWarnings}`);
  }

  trackWarningClick() {
    this.warningClickedForInfo = true;
    this.trackClick();
    console.log('[Analytics] Warning/report clicked for details.');
  }

  startJourney(routeId: string) {
    this.chosenRouteId = routeId;
    this.isJourneyActive = true;
    this.appAccessesDuringJourney = 0; // Will be incremented on mount
    
    // Compute metrics
    const timeToStart = this.destinationSearchTime ? (Date.now() - this.destinationSearchTime) / 1000.0 : null;
    const actions = this.clickCount + this.screenChangeCount;
    const routeChanged = (this.originalRouteId && this.chosenRouteId) ? (this.originalRouteId !== this.chosenRouteId) : false;
    
    // We only count routeChanged if they actually saw warnings
    const routeChangedAfterWarning = this.warningsSeen ? routeChanged : false;

    console.log(`[Analytics] Starting journey. time_to_start=${timeToStart}s, actions=${actions}, route_changed=${routeChangedAfterWarning}`);
    
    // Post to backend
    this.postJourneyMetrics(timeToStart, actions, routeChangedAfterWarning, this.warningClickedForInfo);
  }

  endJourney() {
    if (this.isJourneyActive) {
      console.log(`[Analytics] Ending journey. App accesses during journey: ${this.appAccessesDuringJourney}`);
      // Post updated app accesses to backend by reporting another metrics log containing just accesses
      this.postJourneyMetrics(null, null, null, null, this.appAccessesDuringJourney);
      this.isJourneyActive = false;
      this.appAccessesDuringJourney = 0;
    }
  }

  trackAppAccess() {
    if (this.isJourneyActive) {
      this.appAccessesDuringJourney += 1;
      console.log(`[Analytics] App accessed during journey. Count: ${this.appAccessesDuringJourney}`);
    }
  }

  startDisruptionReport() {
    this.reportOpenTime = Date.now();
    this.trackClick();
    console.log('[Analytics] Started disruption report. Timer started.');
  }

  async endDisruptionReport(wouldContribute: boolean | null = null) {
    const timeTaken = this.reportOpenTime ? (Date.now() - this.reportOpenTime) / 1000.0 : null;
    this.reportOpenTime = null;
    
    console.log(`[Analytics] Disruption report submitted. Time taken: ${timeTaken}s, would_contribute: ${wouldContribute}`);
    
    // Post to backend
    try {
      const response = await fetch(`${API_BASE}/metrics/disruption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          time_taken_seconds: timeTaken,
          would_contribute: wouldContribute,
        }),
      });
      if (!response.ok) {
        console.warn('[Analytics] Failed to post disruption report metrics:', response.status);
      }
    } catch (err) {
      console.warn('[Analytics] Error posting disruption report metrics:', err);
    }
  }

  private async postJourneyMetrics(
    timeToStart: number | null,
    actions: number | null,
    routeChanged: boolean | null,
    warningClicked: boolean | null,
    accesses: number | null = null
  ) {
    try {
      const body = {
        time_to_start_seconds: timeToStart,
        actions_in_timeframe: actions,
        route_changed_after_warning: routeChanged,
        app_accesses_during_journey: accesses,
        warning_clicked_for_info: warningClicked,
      };
      
      const response = await fetch(`${API_BASE}/metrics/journey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        console.warn('[Analytics] Failed to post journey metrics:', response.status);
      }
    } catch (err) {
      console.warn('[Analytics] Error posting journey metrics:', err);
    }
  }
}

export const analytics = new AnalyticsService();
export default analytics;
