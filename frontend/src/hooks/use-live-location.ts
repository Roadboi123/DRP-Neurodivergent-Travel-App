import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export type LocationPermission = 'undetermined' | 'granted' | 'denied';

export interface LiveLocation {
  /** Latest device position as [lat, lon], or null until the first fix. */
  coords: [number, number] | null;
  /** Heading in degrees (0–360), or null when unknown. */
  heading: number | null;
  /** Foreground-location permission state. */
  permission: LocationPermission;
}

/**
 * Track the device's live position (and heading) while mounted, via
 * `expo-location`. Built for the journey screen so the "you are here" marker
 * follows the traveller and reports land at their real location; callers should
 * fall back to a sensible default (e.g. the route origin) while `coords` is null
 * or `permission` is `denied`.
 *
 * Pass `enabled: false` to skip watching entirely.
 */
export function useLiveLocation(enabled: boolean = true): LiveLocation {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<LocationPermission>('undetermined');

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let posSub: Location.LocationSubscription | null = null;
    let headingSub: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setPermission('denied');
          return;
        }
        setPermission('granted');

        posSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            if (cancelled) return;
            setCoords([loc.coords.latitude, loc.coords.longitude]);
            // GPS course is only meaningful while moving; ignore the -1/null idle value.
            if (loc.coords.heading != null && loc.coords.heading >= 0) {
              setHeading(loc.coords.heading);
            }
          },
        );

        // The magnetometer compass is more responsive than GPS course while
        // walking, but is native-only — web has no watchHeadingAsync.
        if (Platform.OS !== 'web') {
          try {
            headingSub = await Location.watchHeadingAsync((h) => {
              if (cancelled) return;
              const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
              if (deg != null && deg >= 0) setHeading(deg);
            });
          } catch {
            // No compass on this device — GPS course (above) is the fallback.
          }
        }
      } catch (e) {
        if (!cancelled) console.warn('Live location unavailable:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (posSub) {
        try {
          posSub.remove();
        } catch (err) {
          console.warn('Failed to remove location subscription:', err);
        }
      }
      if (headingSub) {
        try {
          headingSub.remove();
        } catch (err) {
          console.warn('Failed to remove heading subscription:', err);
        }
      }
    };
  }, [enabled]);

  return { coords, heading, permission };
}
