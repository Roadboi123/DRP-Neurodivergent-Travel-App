import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Animated, AppState, Dimensions, PanResponder, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, ScrollView, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLegUIProps } from '@/components/routes/route-card';
import { SensoryMeter } from '@/components/routes/sensory-meter';
import { WarningConfidence } from '@/components/routes/warning-confidence';
import {
  REPORT_OPTIONS,
  warningMarkerScript,
  warningVisual,
  type SensoryReportType,
} from '@/components/routes/warning-markers';
import { Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLiveLocation } from '@/hooks/use-live-location';
import { useRouteWarnings } from '@/hooks/use-route-warnings';
import { getActiveJourneyRoute, setActiveJourneyRoute, requestReopenJourneyDetails } from '@/services/active-journey';
import { useRoutesService } from '@/services/services-context';
import { useAuth } from '@/context/auth-context';
import type { RouteOption, WarningItem } from '@/types/route';
import { analytics } from '@/services/analytics';
import { haversineMeters } from '@/utils/geo';

// How close (metres) the traveller must get to a warning before we ask them to
// confirm it's still there.
const PROXIMITY_THRESHOLD_M = 80;

/** Human "N minutes ago" from an ISO timestamp; '' when unknown/unparseable. */
function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function calculateHeading(from: [number, number], to: [number, number]): number {
  const dLon = ((to[1] - from[1]) * Math.PI) / 180;
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function buildJourneyMap(route: RouteOption, accents: ReturnType<typeof getAccents>) {
  const processedLegs = (route.legs || []).map((leg) => ({
    ...leg,
    dep_lat: leg.departure_lat,
    dep_lon: leg.departure_lon,
    arr_lat: leg.arrival_lat,
    arr_lon: leg.arrival_lon,
  }));

  const nodes: { lat: number; lon: number; label: string; isStart: boolean; isEnd: boolean }[] = [];
  processedLegs.forEach((leg, index) => {
    if (leg.dep_lat != null && leg.dep_lon != null) {
      nodes.push({
        lat: leg.dep_lat,
        lon: leg.dep_lon,
        label: leg.departure,
        isStart: index === 0,
        isEnd: false,
      });
    }
    if (leg.arr_lat != null && leg.arr_lon != null) {
      nodes.push({
        lat: leg.arr_lat,
        lon: leg.arr_lon,
        label: leg.arrival,
        isStart: false,
        isEnd: index === processedLegs.length - 1,
      });
    }
  });

  const boundsPoints: [number, number][] = [];
  processedLegs.forEach((leg) => {
    if (leg.dep_lat != null && leg.dep_lon != null) boundsPoints.push([leg.dep_lat, leg.dep_lon]);
    if (leg.arr_lat != null && leg.arr_lon != null) boundsPoints.push([leg.arr_lat, leg.arr_lon]);
    if (leg.path_coords) {
      leg.path_coords.forEach((pt) => {
        if (pt && pt.length === 2) {
          boundsPoints.push([pt[0], pt[1]]);
        }
      });
    }
  });

  const centerLat = nodes.length ? nodes.reduce((sum, node) => sum + node.lat, 0) / nodes.length : 51.5074;
  const centerLon = nodes.length ? nodes.reduce((sum, node) => sum + node.lon, 0) / nodes.length : -0.1278;

  let leafletJS = '';
  processedLegs.forEach((leg) => {
    if (leg.dep_lat == null || leg.dep_lon == null || leg.arr_lat == null || leg.arr_lon == null) return;
    const { bgColor } = getLegUIProps(leg.mode, leg.line, leg.instruction, accents);
    const isWalking = leg.mode.toLowerCase() === 'walking' || leg.mode.toLowerCase() === 'walk';
    const points =
      leg.path_coords && leg.path_coords.length > 0
        ? JSON.stringify([
            [leg.dep_lat, leg.dep_lon],
            ...leg.path_coords.slice(1, -1),
            [leg.arr_lat, leg.arr_lon],
          ])
        : `[[${leg.dep_lat}, ${leg.dep_lon}], [${leg.arr_lat}, ${leg.arr_lon}]]`;

    leafletJS += `
      L.polyline(${points}, {
        color: '#1d1c1c',
        weight: ${isWalking ? 10 : 9},
        ${isWalking ? "dashArray: '1, 15'," : ''}
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      L.polyline(${points}, {
        color: '${isWalking ? '#ff158a' : bgColor}',
        weight: ${isWalking ? 6 : 5},
        ${isWalking ? "dashArray: '1, 15'," : ''}
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    `;
  });

  nodes.forEach((node) => {
    const fillColor = node.isStart ? '#83f582' : node.isEnd ? '#ff158a' : '#7af7f7';
    leafletJS += `
      L.circleMarker([${node.lat}, ${node.lon}], {
        radius: ${node.isStart || node.isEnd ? 9 : 6},
        fillColor: '${fillColor}',
        color: '#1d1c1c',
        weight: 2.5,
        opacity: 1,
        fillOpacity: 1
      }).addTo(map).bindPopup("<b>${node.label.replace(/"/g, '\\"')}</b>");
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; background-color: #f2efe9; }
        .leaflet-bar a { background-color: #ffffff !important; color: #1d1c1c !important; border-color: #ccc !important; }
        .warning-marker-icon, .user-location-icon { background: none; border: none; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${centerLat}, ${centerLon}], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        
        ${leafletJS}
        
        let isProgrammatic = false;

        setTimeout(() => {
          map.invalidateSize();
          const bounds = ${JSON.stringify(boundsPoints)};
          if (bounds.length > 0) {
            isProgrammatic = true;
            map.fitBounds(bounds, { paddingTopLeft: [60, 60], paddingBottomRight: [60, 160], maxZoom: 13 });
          }
        }, 200);

        // User Location marker (Crisp, mathematically centered SVG radar cone)
        let userMarker = null;
        window.updateUserLocation = function(lat, lon, heading) {
          const iconHtml = \`
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(\${heading}deg); transform-origin: 20px 20px; display: block;">
              <!-- Heading cone -->
              <path d="M20 20 L8 4 A20 20 0 0 1 32 4 Z" fill="#007aff" fill-opacity="0.4" />
              <!-- Shadow circle -->
              <circle cx="20" cy="21" r="9.5" fill="black" fill-opacity="0.2" />
              <!-- Inner blue circle with white outline -->
              <circle cx="20" cy="20" r="8" fill="#007aff" stroke="white" stroke-width="3" />
            </svg>
          \`;

          const userIcon = L.divIcon({
            html: iconHtml,
            className: 'user-location-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });

          if (!userMarker) {
            userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map);
          } else {
            userMarker.setLatLng([lat, lon]);
            userMarker.setIcon(userIcon);
          }
        };

        window.centerMapOnUser = function(lat, lon) {
          const zoomLevel = 15.5;
          isProgrammatic = true;
          if (userMarker) {
            map.setView(userMarker.getLatLng(), zoomLevel, { animate: true });
          } else if (lat && lon) {
            map.setView([lat, lon], zoomLevel, { animate: true });
          }
        };

        map.on('moveend', function() {
          isProgrammatic = false;
        });

        function notifyDrag() {
          const msg = JSON.stringify({ type: 'mapDrag' });
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(msg);
          } else {
            window.parent.postMessage(msg, '*');
          }
        }

        map.on('dragstart', notifyDrag);
        map.on('zoomstart', function() {
          if (!isProgrammatic) {
            notifyDrag();
          }
        });

        // Warning markers (Waze-style sensory icons) — shared with route details
        ${warningMarkerScript()}

        // Listen for postMessage updates from Web iframe
        window.addEventListener('message', function(event) {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.type === 'updateUserLocation') {
              window.updateUserLocation(data.lat, data.lon, data.heading);
            } else if (data.type === 'updateWarnings') {
              window.updateWarnings(data.warnings);
            } else if (data.type === 'centerMapOnUser') {
              if (window.centerMapOnUser) {
                window.centerMapOnUser(data.lat, data.lon);
              }
            }
          } catch (e) {
            console.error('Error parsing map message:', e);
          }
        });
      </script>
    </body>
    </html>
  `;
}

export default function JourneyScreen() {
  const [activeRoute, setActiveRoute] = useState<RouteOption | null>(() => getActiveJourneyRoute());
  const route = activeRoute;
  const [alternativeRoutes, setAlternativeRoutes] = useState<RouteOption[] | null>(null);
  const [isRerouting, setIsRerouting] = useState(false);
  const [selectedAltRoute, setSelectedAltRoute] = useState<RouteOption | null>(null);
  const routesService = useRoutesService();
  const { username } = useAuth();
  const [followUser, setFollowUser] = useState(true);

  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);

  // Offset the floating top controls/notices by the safe-area inset so they
  // clear the notch/status bar and sit at the same comfortable height as the
  // route-details screen's header (which gets this for free via SafeAreaView).
  const insets = useSafeAreaInsets();

  const webViewRef = useRef<WebView>(null);

  // Warnings state, polling and remove/hide actions — shared with route details.
  const {
    warnings,
    formattedWarnings,
    selectedWarning,
    setSelectedWarning,
    openWarningById,
    selectedIsOwn,
    removeOwnWarning,
    dismissWarning,
    addWarning,
    hideAll,
    setHideAll,
  } = useRouteWarnings(route, accents);

  // States
  const [reportingType, setReportingType] = useState<SensoryReportType | null>(null);
  // Transient banner shown e.g. when a report is rejected as a near-duplicate.
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  // Bumped when the map iframe/WebView finishes loading, so the marker-sync
  // effect re-pushes once the map can actually receive messages (the first push
  // races the async map load and is otherwise dropped).
  const [mapReadyTick, setMapReadyTick] = useState(0);

  // Proximity confirmation: the nearby warning we're currently asking the
  // traveller to confirm, plus the ids they've already answered (yes/no/skip)
  // so we don't re-prompt for the same one this journey.
  const [proximityWarning, setProximityWarning] = useState<WarningItem | null>(null);
  const respondedWarningIds = useRef<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const initialPanDone = useRef(false);

  // Swipe-up bottom sheet (mirrors the pre-Go route-details sheet): collapsed shows
  // duration·cost minimised, expanded reveals sensory alignment + the step timeline.
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;
  const COLLAPSED_HEIGHT = 96;
  const MAX_TRANSLATE_Y = SHEET_HEIGHT - COLLAPSED_HEIGHT;

  const panY = useRef(new Animated.Value(MAX_TRANSLATE_Y)).current;
  const lastTranslateY = useRef(MAX_TRANSLATE_Y);
  const startTranslateY = useRef(MAX_TRANSLATE_Y);
  const scrollOffsetY = useRef(0);

  useEffect(() => {
    const id = panY.addListener(({ value }) => {
      lastTranslateY.current = value;
    });
    return () => panY.removeListener(id);
  }, [panY]);

  const onPanResponderGrant = () => {
    startTranslateY.current = lastTranslateY.current;
    panY.setOffset(startTranslateY.current);
    panY.setValue(0);
  };

  const onPanResponderMove = (_: any, gestureState: any) => {
    const minVal = -startTranslateY.current;
    const maxVal = MAX_TRANSLATE_Y - startTranslateY.current;
    panY.setValue(Math.max(minVal, Math.min(maxVal, gestureState.dy)));
  };

  const onPanResponderRelease = (_: any, gestureState: any) => {
    panY.flattenOffset();
    const currentY = lastTranslateY.current;
    const velocityY = gestureState.vy;
    let targetY = MAX_TRANSLATE_Y;
    if (velocityY < -0.3) {
      targetY = 0;
    } else if (velocityY > 0.3) {
      targetY = MAX_TRANSLATE_Y;
    } else {
      targetY = currentY < MAX_TRANSLATE_Y / 2 ? 0 : MAX_TRANSLATE_Y;
    }
    setIsExpanded(targetY === 0);
    Animated.spring(panY, {
      toValue: targetY,
      useNativeDriver: Platform.OS !== 'web',
      tension: 50,
      friction: 8,
    }).start();
  };

  const headerPanResponder = useRef(
    PanResponder.create({
      // Grab instantly on the bare handle (responsive drag), but capture=false on
      // touch-down so any child control still wins a plain tap; a drag is stolen
      // back on move so the sheet swipes from anywhere on the header.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant,
      onPanResponderMove,
      onPanResponderRelease,
      onPanResponderTerminate: () => {},
    })
  ).current;

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dy, dx } = gestureState;
        const verticalEnough = Math.abs(dy) > 4 && Math.abs(dy) > Math.abs(dx);
        if (!verticalEnough) return false;
        if (dy > 0 && scrollOffsetY.current <= 0) return true;
        if (dy < 0 && lastTranslateY.current > 1) return true;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const { dy, dx } = gestureState;
        const verticalEnough = Math.abs(dy) > 4 && Math.abs(dy) > Math.abs(dx);
        if (!verticalEnough) return false;
        if (dy > 0 && scrollOffsetY.current <= 0) return true;
        if (dy < 0 && lastTranslateY.current > 1) return true;
        return false;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant,
      onPanResponderMove,
      onPanResponderRelease,
      onPanResponderTerminate: () => {},
    })
  ).current;

  // Analytics & Active Journey Lifecycles
  useEffect(() => {
    // Increment initial access on mount
    analytics.trackAppAccess();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        analytics.trackAppAccess();
      }
    });

    // Web iframe postMessage listener
    const handleWebMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'warningClick' && data.id) {
          openWarningById(data.id);
        } else if (data.type === 'mapDrag') {
          setFollowUser(false);
        }
      } catch {
        // Ignore other/external window messages
      }
    };

    if (Platform.OS === 'web') {
      window.addEventListener('message', handleWebMessage);
    }

    return () => {
      subscription.remove();
      if (Platform.OS === 'web') {
        window.removeEventListener('message', handleWebMessage);
      }
      analytics.endJourney();
    };
  }, [openWarningById]);

  // Concatenate path coordinates from all route legs
  const allPathCoords = useMemo(() => {
    if (!route || !route.legs) return [];
    const coords: [number, number][] = [];
    route.legs.forEach((leg) => {
      if (leg.path_coords && leg.path_coords.length > 0) {
        leg.path_coords.forEach((pt) => {
          coords.push([pt[0], pt[1]]);
        });
      } else if (leg.departure_lat != null && leg.departure_lon != null && leg.arrival_lat != null && leg.arrival_lon != null) {
        coords.push([leg.departure_lat, leg.departure_lon]);
        coords.push([leg.arrival_lat, leg.arrival_lon]);
      }
    });
    return coords;
  }, [route]);

  // Live device GPS drives the "you are here" marker and the report location.
  // Until there's a fix (or if permission is denied) we fall back to the journey
  // origin so the screen still works.
  const { coords: liveCoords, heading: liveHeading, permission: locationPermission } =
    useLiveLocation();

  const userCoords = useMemo<[number, number]>(() => {
    return liveCoords ?? allPathCoords[0] ?? [51.5074, -0.1278];
  }, [liveCoords, allPathCoords]);

  const heading = useMemo(() => {
    if (liveHeading != null) return liveHeading;
    if (allPathCoords.length < 2) return 0;
    return calculateHeading(allPathCoords[0], allPathCoords[1]);
  }, [liveHeading, allPathCoords]);

  // When the traveller's REAL location gets within range of a warning they
  // haven't answered yet, surface a confirm prompt. Gated on liveCoords so the
  // route-origin fallback never triggers it, and on no prompt already showing.
  useEffect(() => {
    if (!liveCoords || proximityWarning) return;
    const nearest = warnings
      .filter(
        (w) =>
          w.lat != null &&
          w.lon != null &&
          !respondedWarningIds.current.has(w.id),
      )
      .map((w) => ({ w, dist: haversineMeters(userCoords, [w.lat as number, w.lon as number]) }))
      .filter(({ dist }) => dist <= PROXIMITY_THRESHOLD_M)
      .sort((a, b) => a.dist - b.dist)[0];
    if (nearest) {
      setProximityWarning(nearest.w);
      analytics.trackWarningInteraction();
    }
  }, [liveCoords, userCoords, warnings, proximityWarning]);

  // Record an answer so we don't immediately re-prompt for the same warning.
  const respondProximity = useCallback(
    (action: 'yes' | 'no' | 'skip') => {
      const w = proximityWarning;
      if (!w) return;
      respondedWarningIds.current.add(w.id);
      setProximityWarning(null);
      analytics.trackWarningInteraction();
      if (action === 'no') {
        // No longer there: delete it for everyone if it's the user's own report,
        // otherwise just hide it locally (same rules as the action card).
        const isOwn = !!username && w.username === username;
        if (isOwn) {
          removeOwnWarning(w);
        } else {
          dismissWarning(w);
        }
      }
    },
    [proximityWarning, username, removeOwnWarning, dismissWarning],
  );

  // Sync warnings to the Leaflet map.
  useEffect(() => {
    const jsonString = JSON.stringify(formattedWarnings);
    if (Platform.OS === 'web') {
      const iframe = document.querySelector('iframe');
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'updateWarnings', warnings: jsonString }, '*');
      }
    } else {
      if (webViewRef.current) {
        const js = `if (window.updateWarnings) { window.updateWarnings('${jsonString.replace(/'/g, "\\'")}'); }`;
        webViewRef.current.injectJavaScript(js);
      }
    }
  }, [formattedWarnings, mapReadyTick]);

  // Sync user location and handle center-on-user logic.
  useEffect(() => {
    const shouldPan = (!initialPanDone.current || followUser) && mapReadyTick > 0;
    if (!initialPanDone.current && mapReadyTick > 0) {
      initialPanDone.current = true;
    }

    if (Platform.OS === 'web') {
      const iframe = document.querySelector('iframe');
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'updateUserLocation', lat: userCoords[0], lon: userCoords[1], heading }, '*');
        if (shouldPan) {
          iframe.contentWindow.postMessage({ type: 'centerMapOnUser', lat: userCoords[0], lon: userCoords[1] }, '*');
        }
      }
    } else {
      if (webViewRef.current) {
        let js = `if (window.updateUserLocation) { window.updateUserLocation(${userCoords[0]}, ${userCoords[1]}, ${heading}); }`;
        if (shouldPan) {
          js += `if (window.centerMapOnUser) { window.centerMapOnUser(${userCoords[0]}, ${userCoords[1]}); }`;
        }
        webViewRef.current.injectJavaScript(js);
      }
    }
  }, [userCoords, heading, mapReadyTick, followUser]);

  const handleMapMessage = (event: any) => {
    try {
      const dataStr = event.nativeEvent.data;
      const data = JSON.parse(dataStr);
      if (data.type === 'warningClick' && data.id) {
        openWarningById(data.id);
      } else if (data.type === 'mapDrag') {
        setFollowUser(false);
      }
    } catch {
      // Ignore
    }
  };

  const relocateToUser = () => {
    analytics.trackClick();
    const nextFollow = !followUser;
    setFollowUser(nextFollow);
    if (nextFollow) {
      if (Platform.OS === 'web') {
        const iframe = document.querySelector('iframe');
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'centerMapOnUser', lat: userCoords[0], lon: userCoords[1] }, '*');
        }
      } else {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(
            `if (window.centerMapOnUser) { window.centerMapOnUser(${userCoords[0]}, ${userCoords[1]}); } true;`
          );
        }
      }
    }
  };

  const fetchAlternatives = async () => {
    if (!route) return;
    setIsRerouting(true);
    try {
      const start = `${userCoords[0]},${userCoords[1]}`;
      const lastLeg = route.legs?.[route.legs.length - 1];
      if (!lastLeg) return;
      const end = lastLeg.arrival_lat && lastLeg.arrival_lon
        ? `${lastLeg.arrival_lat},${lastLeg.arrival_lon}`
        : lastLeg.arrival;
        
      const results = await routesService.getRoutes(start, end, username || '');
      setAlternativeRoutes(results);
      if (results && results.length > 0) {
        // Pre-select the best alternative route
        setSelectedAltRoute(results[0]);
      }
    } catch (err) {
      console.warn('Failed to fetch alternative routes:', err);
    } finally {
      setIsRerouting(false);
    }
  };


  const handleAvoidWarningReroute = (warning: WarningItem) => {
    analytics.trackClick();
    fetchAlternatives();
  };

  // Actions — report a sensory warning at the traveller's live GPS location
  // (falls back to the route origin when location is unavailable).
  const submitReport = async () => {
    if (!reportingType) return;
    const option = REPORT_OPTIONS.find((o) => o.type === reportingType);
    if (!option) return;

    const body = {
      id: `w_user_${Date.now()}`,
      username: username || 'anonymous',
      warning_type: option.icon,
      title: `${option.label} reported`,
      desc: `${option.label} flagged here by a traveller.`,
      lat: userCoords[0],
      lon: userCoords[1],
    };

    setReportingType(null);
    analytics.endDisruptionReport(true);
    analytics.trackWarningInteraction();

    try {
      const result = await routesService.reportWarning(body);
      if (result.duplicate) {
        setReportNotice('Already reported nearby');
      } else {
        addWarning(result.warning);
      }
    } catch (err) {
      console.warn('Failed to persist warning report on backend:', err);
    }
  };

  // Auto-dismiss the transient notice after a few seconds.
  useEffect(() => {
    if (!reportNotice) return;
    const timer = setTimeout(() => setReportNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [reportNotice]);

  const mapHtml = useMemo(() => {
    const previewRoute = selectedAltRoute || route;
    return previewRoute ? buildJourneyMap(previewRoute, accents) : '';
  }, [route, selectedAltRoute, accents]);

  if (!route) {
    return (
      <SafeAreaView style={[styles.screen, styles.emptyState, { backgroundColor: palette.background }]}>
        <Text style={[styles.emptyText, { color: palette.textPrimary }]}>No active journey.</Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/routes')}
          style={[styles.backBtnAction, { backgroundColor: accents.green, borderColor: palette.border }]}
        >
          <Text style={[styles.backBtnActionText, { color: palette.textPrimary }]}>Routes</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const activeReport = REPORT_OPTIONS.find((o) => o.type === reportingType);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.surface }]}>
      <View style={StyleSheet.absoluteFill}>
        {Platform.OS === 'web' ? (
          <iframe
            srcDoc={mapHtml}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Journey Map"
            onLoad={() => setMapReadyTick((t) => t + 1)}
          />
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            originWhitelist={['*']}
            domStorageEnabled={true}
            javaScriptEnabled={true}
            onMessage={handleMapMessage}
            onLoadEnd={() => setMapReadyTick((t) => t + 1)}
          />
        )}
      </View>

      {/* Top Left Navigation Icons (Back and Home) */}
      <View
        pointerEvents="box-none"
        style={[styles.topControls, { top: insets.top + 16 }]}
      >
        <View style={styles.navButtonsRow}>
          <TouchableOpacity
            onPress={() => {
              // Return to the route details sheet shown before "Go", not the bare list.
              requestReopenJourneyDetails();
              router.back();
            }}
            style={[styles.circleButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
            accessibilityRole="button"
            accessibilityLabel="Back to route details"
          >
            <Ionicons name="arrow-back" size={20} color={palette.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/routes')}
            style={[styles.circleButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
            accessibilityRole="button"
            accessibilityLabel="Home"
          >
            <Ionicons name="home-outline" size={20} color={palette.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Hide / show all warning markers */}
        <TouchableOpacity
          onPress={() => {
            analytics.trackClick();
            setHideAll(!hideAll);
          }}
          style={[
            styles.circleButton,
            { backgroundColor: hideAll ? accents.yellow : palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel={hideAll ? 'Show sensory warnings on map' : 'Hide sensory warnings from map'}
        >
          <Ionicons name={hideAll ? 'eye-off' : 'eye'} size={20} color={palette.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Transient notice (e.g. duplicate report rejected) */}
      {reportNotice && (
        <View style={[styles.noticeBanner, { top: insets.top + 76, backgroundColor: accents.yellow, borderColor: palette.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={palette.textPrimary} />
          <Text style={[styles.noticeBannerText, { color: palette.textPrimary }]}>{reportNotice}</Text>
        </View>
      )}

      {/* Location-off fallback notice — reports/marker use the route start instead */}
      {!reportNotice && locationPermission === 'denied' && (
        <View style={[styles.noticeBanner, { top: insets.top + 76, backgroundColor: accents.orange, borderColor: palette.border }]}>
          <Ionicons name="location-outline" size={16} color={palette.textPrimary} />
          <Text style={[styles.noticeBannerText, { color: palette.textPrimary }]}>
            Location off — using route start
          </Text>
        </View>
      )}

      {/* Grouped Right Capsule-style Rail — tap a type to report it here */}
      <View style={[styles.reportCapsule, { top: insets.top + 144, backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.reportCapsuleHeader, { color: palette.textSecondary }]}>Report</Text>
        <View style={[styles.reportDivider, { backgroundColor: palette.divider }]} />
        {REPORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.type}
            activeOpacity={0.85}
            onPress={() => {
              analytics.startDisruptionReport();
              setReportingType(option.type);
            }}
            style={[
              styles.reportCapsuleBtn,
              {
                backgroundColor: reportingType === option.type ? accents[option.accent] : palette.surface,
              },
            ]}
          >
            <Ionicons name={option.icon} size={16} color={palette.textPrimary} />
            <Text style={[styles.reportCapsuleLabel, { color: palette.textPrimary }]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Swipe-up journey sheet — collapsed shows duration·cost; swipe up for details */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.sheetPanel,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            height: SHEET_HEIGHT,
            transform: [{ translateY: panY }],
          },
        ]}
      >
        <View style={styles.sheetHeaderTouch} {...headerPanResponder.panHandlers}>
          <View style={styles.sheetHandleContainer}>
            <View style={[styles.sheetHandle, { backgroundColor: palette.divider }]} />
          </View>
          {/* Duration & cost, minimised, on the left */}
          <View style={[styles.sheetStatsRow, { borderBottomColor: palette.divider }]}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={[styles.sheetDuration, { color: palette.textPrimary }]}>{route.duration} min</Text>
              <Text style={[styles.sheetDot, { color: palette.textMuted }]}>·</Text>
              <Text style={[styles.sheetCost, { color: palette.textSecondary }]}>£{route.price.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View pointerEvents={isExpanded ? 'auto' : 'none'} style={{ flex: 1 }} {...sheetPanResponder.panHandlers}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.detailsScrollContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              scrollOffsetY.current = e.nativeEvent.contentOffset.y;
            }}
          >
            {/* Sensory alignment dashboard */}
            <View style={[styles.detailsCard, { borderColor: palette.border, backgroundColor: palette.surface }]}>
              <Text style={[styles.detailsCardHeading, { color: palette.textPrimary }]}>Sensory alignment</Text>
              <View style={styles.detailsSensoryRow}>
                <SensoryMeter level={route.noise} label="Sound" />
                <SensoryMeter level={route.crowds} label="Crowds" />
                <SensoryMeter level={route.heat} label="Heat" />
                <SensoryMeter level={route.light} label="Light" />
                <SensoryMeter level={route.smell} label="Smell" />
              </View>
              {route.sensory_description ? (
                <Text style={[styles.detailsSensoryDesc, { color: palette.textSecondary, borderTopColor: palette.divider }]}>
                  {route.sensory_description}
                </Text>
              ) : null}
            </View>

            {/* Step-by-step leg timeline */}
            <View style={styles.detailsTimeline}>
              {route.legs && route.legs.map((leg, lIdx) => {
                const { iconName, bgColor: lineBgColor, textColor: lineTextColor } = getLegUIProps(
                  leg.mode,
                  leg.line,
                  leg.instruction,
                  accents
                );
                const isWalking = leg.mode.toLowerCase() === 'walking' || leg.mode.toLowerCase() === 'walk';
                return (
                  <View key={lIdx} style={styles.detailStepContainer}>
                    <View style={styles.stepIndicatorCol}>
                      <View style={[styles.stepNode, { backgroundColor: lineBgColor, borderColor: palette.border }]}>
                        <Ionicons name={iconName} size={11} color={lineTextColor} />
                      </View>
                      <View style={[styles.stepLine, { backgroundColor: lineBgColor }]} />
                    </View>
                    <View style={styles.stepContentCol}>
                      <Text style={[styles.detailsStation, { color: palette.textPrimary }]}>{leg.departure}</Text>
                      <Text style={[styles.detailsInstruction, { color: palette.textSecondary }]}>
                        {leg.instruction} ({leg.duration_mins} mins)
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Ionicons
                          name={isWalking ? 'walk-outline' : 'exit-outline'}
                          size={13}
                          color={palette.textSecondary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.detailsArrival, { color: palette.textSecondary }]}>
                          {isWalking ? 'Walk to ' : 'Get off at '}
                          <Text style={{ fontWeight: '800', color: palette.textPrimary }}>{leg.arrival}</Text>
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {route.legs && route.legs.length > 0 && (
                <View style={styles.detailStepContainer}>
                  <View style={styles.stepIndicatorCol}>
                    <View style={[styles.stepNode, { backgroundColor: palette.textPrimary, borderColor: palette.border }]}>
                      <Ionicons name="pin" size={11} color={palette.surface} />
                    </View>
                  </View>
                  <View style={styles.stepContentCol}>
                    <Text style={[styles.detailsStation, { color: palette.textPrimary }]}>
                      {route.legs[route.legs.length - 1].arrival}
                    </Text>
                    <Text style={[styles.detailsInstruction, { color: palette.textSecondary }]}>
                      Arrive at destination
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Animated.View>

      {/* Waze style reporting action bar — centred on screen */}
      {reportingType && activeReport && (
        <View style={styles.reportOverlayRoot} pointerEvents="box-none">
          <View style={styles.reportBackdrop} pointerEvents="none" />
          <View style={styles.reportCenterContainer} pointerEvents="box-none">
            <View style={[styles.reportInputPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <TouchableOpacity
                onPress={() => {
                  analytics.trackClick();
                  setReportingType(null);
                  analytics.endDisruptionReport(null);
                }}
                style={[styles.reportCancelBtn, { backgroundColor: accents.pink, borderColor: palette.border }]}
                accessibilityRole="button"
                accessibilityLabel="Cancel report"
              >
                <Ionicons name="close" size={16} color={palette.textPrimary} />
              </TouchableOpacity>

              <View style={[styles.reportTypeCircle, { backgroundColor: accents[activeReport.accent], borderColor: palette.border }]}>
                <Ionicons name={activeReport.icon} size={26} color={palette.textPrimary} />
                <Text style={[styles.reportTypeCircleText, { color: palette.textPrimary }]}>{activeReport.label}</Text>
              </View>

              <TouchableOpacity
                onPress={() => submitReport()}
                activeOpacity={0.85}
                style={[styles.reportSubmitBtn, { backgroundColor: accents.green, borderColor: palette.border }]}
              >
                <Text style={[styles.reportSubmitBtnText, { color: palette.textPrimary }]}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Tapped-warning action card — Remove (own) or Close (someone else's) */}
      {selectedWarning && (
        <View style={styles.reportOverlayRoot} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.reportBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedWarning(null)}
          />
          <View style={styles.reportCenterContainer} pointerEvents="box-none">
            <View style={[styles.warningCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <TouchableOpacity
                onPress={() => setSelectedWarning(null)}
                style={[styles.reportCancelBtn, { backgroundColor: accents.pink, borderColor: palette.border }]}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              >
                <Ionicons name="close" size={16} color={palette.textPrimary} />
              </TouchableOpacity>

              <View
                style={[
                  styles.warningCardIcon,
                  { backgroundColor: warningVisual(selectedWarning.icon, accents).color, borderColor: palette.border },
                ]}
              >
                <Text style={styles.warningListEmoji}>{warningVisual(selectedWarning.icon, accents).emoji}</Text>
              </View>

              <Text style={[styles.warningCardTitle, { color: palette.textPrimary }]}>{selectedWarning.title}</Text>
              <WarningConfidence warning={selectedWarning} />
              <Text style={[styles.warningCardDesc, { color: palette.textSecondary }]}>{selectedWarning.desc}</Text>

              <TouchableOpacity
                onPress={() => (selectedIsOwn ? removeOwnWarning(selectedWarning) : dismissWarning(selectedWarning))}
                activeOpacity={0.85}
                style={[
                  styles.warningCardAction,
                  { backgroundColor: selectedIsOwn ? accents.pink : accents.green, borderColor: palette.border },
                ]}
              >
                <Ionicons name={selectedIsOwn ? 'trash-outline' : 'eye-off-outline'} size={15} color={palette.textPrimary} />
                <Text style={[styles.warningCardActionText, { color: palette.textPrimary }]}>
                  {selectedIsOwn ? 'Remove' : 'Close'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleAvoidWarningReroute(selectedWarning)}
                activeOpacity={0.85}
                style={[
                  styles.warningCardAction,
                  { backgroundColor: accents.orange, borderColor: palette.border, marginTop: 8 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Reroute to avoid this warning"
              >
                <Ionicons name="git-branch-outline" size={15} color={palette.textPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.warningCardActionText, { color: palette.textPrimary }]}>
                  Reroute to Avoid
                </Text>
              </TouchableOpacity>

              <Text style={[styles.warningCardHint, { color: palette.textMuted }]}>
                {selectedIsOwn ? 'Removes it from the map for everyone' : 'Hides it for you only'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Proximity confirm prompt — shown when the traveller nears a warning */}
      {proximityWarning && (
        <View style={styles.reportOverlayRoot} pointerEvents="box-none">
          <View style={styles.reportBackdrop} pointerEvents="none" />
          <View style={styles.reportCenterContainer} pointerEvents="box-none">
            <View style={[styles.warningCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View
                style={[
                  styles.warningCardIcon,
                  { backgroundColor: warningVisual(proximityWarning.icon, accents).color, borderColor: palette.border },
                ]}
              >
                <Text style={styles.warningListEmoji}>{warningVisual(proximityWarning.icon, accents).emoji}</Text>
              </View>

              <Text style={[styles.warningCardTitle, { color: palette.textPrimary }]}>Still here?</Text>
              <Text style={[styles.proximityPromptSub, { color: palette.textSecondary }]}>{proximityWarning.title}</Text>
              {formatTimeAgo(proximityWarning.last_reported) ? (
                <Text style={[styles.proximityPromptMeta, { color: palette.textMuted }]}>
                  Last reported {formatTimeAgo(proximityWarning.last_reported)}
                </Text>
              ) : null}

              <View style={styles.proximityActionsRow}>
                <TouchableOpacity
                  onPress={() => respondProximity('yes')}
                  activeOpacity={0.85}
                  style={[styles.proximityActionBtn, { backgroundColor: accents.green, borderColor: palette.border }]}
                  accessibilityRole="button"
                  accessibilityLabel="Yes, still here"
                >
                  <Ionicons name="checkmark" size={16} color={palette.textPrimary} />
                  <Text style={[styles.proximityActionText, { color: palette.textPrimary }]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => respondProximity('no')}
                  activeOpacity={0.85}
                  style={[styles.proximityActionBtn, { backgroundColor: accents.pink, borderColor: palette.border }]}
                  accessibilityRole="button"
                  accessibilityLabel="No, it's gone"
                >
                  <Ionicons name="close" size={16} color={palette.textPrimary} />
                  <Text style={[styles.proximityActionText, { color: palette.textPrimary }]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => respondProximity('skip')}
                  activeOpacity={0.85}
                  style={[styles.proximityActionBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
                  accessibilityRole="button"
                  accessibilityLabel="Skip"
                >
                  <Text style={[styles.proximityActionText, { color: palette.textPrimary }]}>Skip</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.warningCardHint, { color: palette.textMuted }]}>
                Help keep warnings accurate for nearby travellers
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Relocation / Recenter GPS button */}
      <TouchableOpacity
        onPress={relocateToUser}
        style={[
          styles.circleButton,
          {
            position: 'absolute',
            bottom: COLLAPSED_HEIGHT + 16,
            right: 16,
            zIndex: 10,
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={followUser ? "Disable snap to my location" : "Recenter map on my location"}
      >
        <Ionicons
          name={followUser ? "locate" : "locate-outline"}
          size={20}
          color={followUser ? (isDark ? accents.cyan : '#007aff') : palette.textPrimary}
        />
      </TouchableOpacity>

      {/* Alternative Routes Selection Overlay */}
      {alternativeRoutes && (
        <View style={styles.reportOverlayRoot} pointerEvents="box-none">
          <View style={styles.reportBackdrop} pointerEvents="none" />
          <View style={styles.reportCenterContainer} pointerEvents="box-none">
            <View style={[styles.altRoutesPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.altRoutesHeading, { color: palette.textPrimary }]}>Choose Alternative Route</Text>
              
              <ScrollView style={styles.altRoutesScroll} showsVerticalScrollIndicator={false}>
                {alternativeRoutes.map((alt) => {
                  const isSelected = selectedAltRoute?.id === alt.id;
                  const isCalmest = alt.type === 'best';
                  const isQuickest = alt.type === 'quickest';
                  
                  return (
                    <TouchableOpacity
                      key={alt.id}
                      onPress={() => setSelectedAltRoute(alt)}
                      activeOpacity={0.85}
                      style={[
                        styles.altRouteCard,
                        {
                          borderColor: isSelected ? accents.orange : palette.border,
                          backgroundColor: isSelected ? palette.background : palette.surface,
                          borderWidth: isSelected ? 2.5 : 1.5,
                        }
                      ]}
                    >
                      <View style={styles.altRouteHeader}>
                        <Text style={[styles.altRouteName, { color: palette.textPrimary }]}>{alt.name}</Text>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {isCalmest && (
                            <View style={[styles.altBadge, { backgroundColor: accents.green, borderColor: 'transparent' }]}>
                              <Text style={[styles.altBadgeText, { color: palette.textPrimary }]}>Calmest</Text>
                            </View>
                          )}
                          {isQuickest && (
                            <View style={[styles.altBadge, { backgroundColor: accents.cyan, borderColor: 'transparent' }]}>
                              <Text style={[styles.altBadgeText, { color: palette.textPrimary }]}>Quickest</Text>
                            </View>
                          )}
                          <View style={[styles.altBadge, { backgroundColor: palette.border, borderColor: 'transparent' }]}>
                            <Text style={[styles.altBadgeText, { color: palette.textSecondary }]}>{alt.match_percentage}% match</Text>
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.altRouteStats}>
                        <Text style={[styles.altRouteDuration, { color: palette.textPrimary }]}>{alt.duration} min</Text>
                        <Text style={[styles.altRoutePrice, { color: palette.textSecondary }]}>£{alt.price.toFixed(2)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              
              <View style={styles.altRoutesActions}>
                <TouchableOpacity
                  onPress={() => {
                    setAlternativeRoutes(null);
                    setSelectedAltRoute(null);
                  }}
                  style={[styles.altRouteCancelBtn, { backgroundColor: accents.pink, borderColor: palette.border }]}
                >
                  <Text style={[styles.altRouteBtnText, { color: palette.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => {
                    if (selectedAltRoute) {
                      setActiveJourneyRoute(selectedAltRoute);
                      setActiveRoute(selectedAltRoute);
                    }
                    setAlternativeRoutes(null);
                    setSelectedAltRoute(null);
                    setSelectedWarning(null);
                  }}
                  style={[styles.altRouteConfirmBtn, { backgroundColor: accents.green, borderColor: palette.border }]}
                >
                  <Text style={[styles.altRouteBtnText, { color: palette.textPrimary }]}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Rerouting Loading Spinner Overlay */}
      {isRerouting && (
        <View style={styles.reportOverlayRoot} pointerEvents="box-none">
          <View style={styles.reportBackdrop} pointerEvents="none" />
          <View style={styles.reportCenterContainer} pointerEvents="none">
            <View style={[styles.loadingPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <ActivityIndicator size="large" color={accents.orange} />
              <Text style={[styles.loadingText, { color: palette.textPrimary, marginTop: 12 }]}>Finding alternative routes...</Text>
            </View>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  topControls: {
    position: 'absolute',
    // `top` is applied inline as insets.top + 16 (see render) so the controls
    // clear the notch/status bar instead of being pinned to the screen edge.
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow(3),
  },
  noticeBanner: {
    position: 'absolute',
    // `top` applied inline as insets.top + 76 (see render).
    left: 16,
    right: 16,
    zIndex: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    ...hardShadow(3),
  },
  noticeBannerText: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  reportCapsule: {
    position: 'absolute',
    // `top` applied inline as insets.top + 144 (see render).
    right: 16,
    width: 54,
    zIndex: 10,
    borderWidth: 2.5,
    borderRadius: 22,
    padding: 5,
    gap: 4,
    alignItems: 'center',
    ...hardShadow(3),
  },
  reportCapsuleHeader: {
    fontSize: 8,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  reportDivider: {
    height: 1.5,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  reportCapsuleBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 1,
  },
  reportCapsuleLabel: {
    fontSize: 7.5,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sheetPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    overflow: 'hidden',
    ...hardShadow(10),
  },
  sheetHeaderTouch: {
    width: '100%',
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  sheetStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
  },
  rerouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    ...hardShadow(2),
  },
  rerouteBtnText: {
    fontSize: 10,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sheetDuration: {
    fontSize: 17,
    fontFamily: Fonts?.display,
    fontWeight: '900',
  },
  sheetDot: {
    fontSize: 15,
    fontWeight: '900',
  },
  sheetCost: {
    fontSize: 14,
    fontFamily: Fonts?.display,
    fontWeight: '800',
  },
  reportOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  reportBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  reportCenterContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reportInputPanel: {
    borderWidth: 3,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    width: '100%',
    maxWidth: 300,
    ...hardShadow(6),
  },
  reportCancelBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow(2),
  },
  reportTypeCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  reportTypeCircleText: {
    fontSize: 8,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  reportSubmitBtn: {
    borderWidth: 2.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow(2),
  },
  reportSubmitBtnText: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  warningListEmoji: {
    fontSize: 22,
  },
  warningCard: {
    borderWidth: 3,
    borderRadius: 20,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
    gap: 8,
    ...hardShadow(6),
  },
  warningCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCardTitle: {
    fontSize: 15,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
  },
  warningCardDesc: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
  warningCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignSelf: 'stretch',
    marginTop: 4,
    ...hardShadow(2),
  },
  warningCardActionText: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  warningCardHint: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  proximityPromptSub: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  proximityPromptMeta: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -2,
  },
  proximityActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'stretch',
    marginTop: 4,
  },
  proximityActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 2.5,
    borderRadius: 12,
    paddingVertical: 12,
    ...hardShadow(2),
  },
  proximityActionText: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  detailsScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  detailsCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    ...hardShadow(4),
  },
  detailsCardHeading: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  detailsSensoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailsSensoryDesc: {
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 6,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  detailsTimeline: {
    gap: 12,
    marginTop: 4,
  },
  detailStepContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  stepIndicatorCol: {
    alignItems: 'center',
    width: 24,
    alignSelf: 'stretch',
  },
  stepNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepLine: {
    width: 2.5,
    flex: 1,
    marginTop: -2,
    marginBottom: -10,
    zIndex: 1,
  },
  stepContentCol: {
    flex: 1,
    gap: 2,
    paddingBottom: 12,
  },
  detailsStation: {
    fontSize: 13,
    fontWeight: '800',
  },
  detailsInstruction: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsArrival: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  backBtnAction: {
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...hardShadow(2),
  },
  backBtnActionText: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  altRoutesPanel: {
    width: '90%',
    maxWidth: 420,
    maxHeight: '75%',
    borderRadius: 22,
    borderWidth: 2.5,
    padding: 16,
    ...hardShadow(5),
  },
  altRoutesHeading: {
    fontSize: 15,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  altRoutesScroll: {
    marginVertical: 8,
  },
  altRouteCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    ...hardShadow(2),
  },
  altRouteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  altRouteName: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  altRouteStats: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'baseline',
  },
  altRouteDuration: {
    fontSize: 14,
    fontWeight: '800',
  },
  altRoutePrice: {
    fontSize: 12,
    fontWeight: '600',
  },
  altBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  altBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  altRoutesActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  altRouteCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow(2),
  },
  altRouteConfirmBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow(2),
  },
  altRouteBtnText: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  loadingPanel: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: 220,
    ...hardShadow(4),
  },
  loadingText: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
  },
});
