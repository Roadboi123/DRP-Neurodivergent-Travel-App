import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Animated, AppState, Dimensions, PanResponder, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLegUIProps } from '@/components/routes/route-card';
import { WarningConfidence } from '@/components/routes/warning-confidence';
import {
  REPORT_OPTIONS,
  WALK_BLUE,
  modeEmoji,
  warningDisplayDesc,
  warningMarkerScript,
  warningVisual,
  type SensoryReportType,
} from '@/components/routes/warning-markers';
import { BlurView } from 'expo-blur';

import { CLEARWAY, Fonts, GLASS, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLiveLocation } from '@/hooks/use-live-location';
import { useRouteWarnings } from '@/hooks/use-route-warnings';
import { getActiveJourneyLabels, getActiveJourneyRoute, requestReopenJourneyDetails } from '@/services/active-journey';
import { useRoutesService } from '@/services/services-context';
import { useAuth } from '@/context/auth-context';
import type { RouteOption, WarningItem } from '@/types/route';
import { analytics } from '@/services/analytics';
import { haversineMeters, nearestRouteStop } from '@/utils/geo';
import { buildChangeInstruction, cleanInstruction, cleanPlaceLabel } from '@/utils/place-label';
import { sendLocalNotification } from '@/services/notifications';

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

  // Merge each leg's endpoints into physical points: where one leg ends and the
  // next begins at the same place that's a single "change here" interchange, not
  // two dots. `boardMode` is the mode you board at that change, used to pick the
  // transport emoji on its white marker.
  type JNode = {
    lat: number;
    lon: number;
    label: string;
    isStart: boolean;
    isEnd: boolean;
    isChange: boolean;
    boardMode: string;
  };
  const nodes: JNode[] = [];
  const addNode = (
    lat: number | null | undefined,
    lon: number | null | undefined,
    label: string,
    flags: { isStart?: boolean; isEnd?: boolean; isChange?: boolean; boardMode?: string },
  ) => {
    if (lat == null || lon == null) return;
    const last = nodes[nodes.length - 1];
    if (last) {
      const sameName = !!label && last.label.toLowerCase() === label.toLowerCase();
      const nearby = Math.abs(last.lat - lat) < 0.0003 && Math.abs(last.lon - lon) < 0.0003;
      if (sameName || nearby) {
        last.isStart = last.isStart || !!flags.isStart;
        last.isEnd = last.isEnd || !!flags.isEnd;
        last.isChange = last.isChange || !!flags.isChange;
        if (flags.boardMode) last.boardMode = flags.boardMode;
        return;
      }
    }
    nodes.push({
      lat,
      lon,
      label,
      isStart: !!flags.isStart,
      isEnd: !!flags.isEnd,
      isChange: !!flags.isChange,
      boardMode: flags.boardMode || '',
    });
  };
  processedLegs.forEach((leg, index) => {
    const isFirst = index === 0;
    const isLast = index === processedLegs.length - 1;
    addNode(leg.dep_lat, leg.dep_lon, leg.departure, {
      isStart: isFirst,
      isChange: !isFirst,
      boardMode: leg.mode,
    });
    addNode(leg.arr_lat, leg.arr_lon, leg.arrival, { isEnd: isLast, isChange: !isLast });
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
        color: '${isWalking ? WALK_BLUE : bgColor}',
        weight: ${isWalking ? 6 : 5},
        ${isWalking ? "dashArray: '1, 15'," : ''}
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    `;
  });

  // Build a readable interchange instruction for each change, keyed by the change
  // station, so a tapped change marker explains the transfer in plain language.
  const changePopupByKey: Record<string, string> = {};
  for (let i = 0; i < processedLegs.length - 1; i++) {
    const fromLeg = processedLegs[i];
    const toLeg = processedLegs[i + 1];
    changePopupByKey[(toLeg.departure || fromLeg.arrival || '').toLowerCase()] =
      buildChangeInstruction(fromLeg, toLeg);
  }

  // Start (green) and end (red) stay as plain dots; every interior point is a
  // "change here" and gets a white marker with the boarding mode's emoji.
  const changeNodes: { lat: number; lon: number; label: string; emoji: string; popup: string }[] = [];
  nodes.forEach((node) => {
    if (node.isStart || node.isEnd) {
      const fillColor = node.isStart ? '#5b9d6b' : '#e23b3b';
      leafletJS += `
      L.circleMarker([${node.lat}, ${node.lon}], {
        radius: 9,
        fillColor: '${fillColor}',
        color: '#1d1c1c',
        weight: 2.5,
        opacity: 1,
        fillOpacity: 1
      }).addTo(map).bindPopup("<b>${cleanPlaceLabel(node.label, 'Stop').replace(/"/g, '\\"')}</b>");
      `;
    } else {
      const label = cleanPlaceLabel(node.label, 'Change here');
      changeNodes.push({
        lat: node.lat,
        lon: node.lon,
        label,
        emoji: modeEmoji(node.boardMode),
        popup: changePopupByKey[(node.label || '').toLowerCase()] || label,
      });
    }
  });

  // White "change here" markers, toggled together by window.setChangeMarkersHidden.
  leafletJS += `
    const changeNodes = ${JSON.stringify(changeNodes)};
    let changeMarkers = [];
    let changeHidden = false;
    function renderChangeMarkers() {
      changeMarkers.forEach((m) => map.removeLayer(m));
      changeMarkers = [];
      if (changeHidden) return;
      changeNodes.forEach((c) => {
        const html = '<div style="background:#ffffff;width:32px;height:32px;border-radius:50%;border:3px solid #1d1c1c;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 5px rgba(0,0,0,0.3);"><span style="font-size:16px;line-height:1;">' + c.emoji + '</span></div>';
        const icon = L.divIcon({ html: html, className: 'change-marker-icon', iconSize: [32, 32], iconAnchor: [16, 16] });
        const m = L.marker([c.lat, c.lon], { icon: icon }).addTo(map).bindPopup('<b>' + c.popup.replace(/"/g, '&quot;') + '</b>');
        changeMarkers.push(m);
      });
    }
    window.setChangeMarkersHidden = function(hidden) {
      changeHidden = !!hidden;
      renderChangeMarkers();
    };
    renderChangeMarkers();
  `;

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
        .warning-marker-icon, .user-location-icon, .change-marker-icon { background: none; border: none; }
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

        window.centerMapOnUser = function(lat, lon, animate) {
          const zoomLevel = 15.5;
          isProgrammatic = true;
          const shouldAnimate = animate !== false;
          if (userMarker) {
            map.setView(userMarker.getLatLng(), zoomLevel, { animate: shouldAnimate });
          } else if (lat && lon) {
            map.setView([lat, lon], zoomLevel, { animate: shouldAnimate });
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
                window.centerMapOnUser(data.lat, data.lon, data.animate);
              }
            } else if (data.type === 'setChangeMarkersHidden') {
              if (window.setChangeMarkersHidden) {
                window.setChangeMarkersHidden(data.hidden);
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
  const [activeRoute] = useState<RouteOption | null>(() => getActiveJourneyRoute());
  const route = activeRoute;
  // Friendly fallbacks for coordinate-only leg endpoints: prefer the labels the
  // traveller typed (e.g. "Westfield London") over a generic phrase.
  const journeyLabels = getActiveJourneyLabels();
  const originFallback = cleanPlaceLabel(journeyLabels.origin, 'Your location');
  const destinationFallback = cleanPlaceLabel(journeyLabels.destination, 'your destination');
  const routesService = useRoutesService();
  const { username } = useAuth();
  const [followUser, setFollowUser] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);

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
    selectedCluster,
    setSelectedCluster,
    openWarningById,
    openClusterByIds,
    selectedIsOwn,
    removeOwnWarning,
    dismissWarning,
    addWarning,
    hideAll,
    setHideAll,
  } = useRouteWarnings(route, accents, true, true);

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

  // `hideChanges` toggles the white "change here" markers on the map (the toggle
  // now lives in the top pill row; the legend itself is a static panel).
  const [hideChanges, setHideChanges] = useState(false);
  // Per-leg expanded state for the intermediate-stops dropdown in the journey sheet.
  const [stopsExpanded, setStopsExpanded] = useState<Record<number, boolean>>({});

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
      // Clamp overshoot so collapsing doesn't dip past the resting position and
      // bounce back — that bounce read as a downward "glitch" on swipe-down.
      overshootClamping: true,
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
        } else if (data.type === 'warningClusterClick' && data.ids) {
          openClusterByIds(data.ids);
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
  }, [openWarningById, openClusterByIds]);

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

  // Estimate cumulative elapsed time (in minutes) for each coordinate point
  const pathTimes = useMemo(() => {
    if (!route || !route.legs) return [];
    const times: number[] = [];
    let cumulativeTime = 0;
    route.legs.forEach((leg) => {
      const legDuration = leg.duration_mins + (leg.connection_waiting_mins ?? 0);
      const pointsCount = leg.path_coords?.length || 2;
      const timePerPoint = legDuration / pointsCount;
      const points = leg.path_coords && leg.path_coords.length > 0
        ? leg.path_coords
        : [[leg.departure_lat, leg.departure_lon], [leg.arrival_lat, leg.arrival_lon]];
      
      points.forEach(() => {
        times.push(cumulativeTime);
        cumulativeTime += timePerPoint;
      });
    });
    return times;
  }, [route]);

  // Live device GPS drives the "you are here" marker and the report location.
  // Until there's a fix (or if permission is denied) we fall back to the journey
  // origin so the screen still works.
  const { coords: liveCoords, heading: liveHeading, permission: locationPermission } =
    useLiveLocation();

  const userCoords = useMemo<[number, number]>(() => {
    if (simulating && allPathCoords.length > 0) {
      return allPathCoords[Math.min(simIndex, allPathCoords.length - 1)];
    }
    return liveCoords ?? allPathCoords[0] ?? [51.5074, -0.1278];
  }, [simulating, simIndex, liveCoords, allPathCoords]);

  const heading = useMemo(() => {
    if (simulating && allPathCoords.length > 0) {
      const idx = Math.min(simIndex, allPathCoords.length - 1);
      if (idx < allPathCoords.length - 1) {
        return calculateHeading(allPathCoords[idx], allPathCoords[idx + 1]);
      }
      if (idx > 0) {
        return calculateHeading(allPathCoords[idx - 1], allPathCoords[idx]);
      }
      return 0;
    }
    if (liveHeading != null) return liveHeading;
    if (allPathCoords.length < 2) return 0;
    return calculateHeading(allPathCoords[0], allPathCoords[1]);
  }, [simulating, simIndex, liveHeading, allPathCoords]);

  // When the traveller's location gets within range of a warning they
  // haven't answered yet, surface a confirm prompt. Gated on location availability
  // (liveCoords or simulation active) so the route-origin fallback never triggers it unless simulating,
  // and on no prompt already showing.
  useEffect(() => {
    const activeLocationSource = simulating ? userCoords : liveCoords;
    if (!activeLocationSource || proximityWarning) return;
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
  }, [simulating, liveCoords, userCoords, warnings, proximityWarning]);

  // Set to track warning IDs that we have already sent an "upcoming" notification for
  const notifiedUpcomingWarningIds = useRef<Set<string>>(new Set());
  const prevRouteIdForUpcomingRef = useRef<string | null>(null);

  // Reset notified list if the route changes
  useEffect(() => {
    const currentRouteId = route?.id || null;
    if (currentRouteId !== prevRouteIdForUpcomingRef.current) {
      notifiedUpcomingWarningIds.current = new Set();
      prevRouteIdForUpcomingRef.current = currentRouteId;
    }
  }, [route]);

  useEffect(() => {
    const activeLocationSource = simulating ? userCoords : liveCoords;
    if (!activeLocationSource || !route || allPathCoords.length === 0 || pathTimes.length === 0) return;

    // Find the traveler's current index in allPathCoords
    let userIdx = 0;
    let minUserDist = Infinity;
    for (let i = 0; i < allPathCoords.length; i++) {
      const dist = haversineMeters(activeLocationSource, allPathCoords[i]);
      if (dist < minUserDist) {
        minUserDist = dist;
        userIdx = i;
      }
    }

    const userTime = pathTimes[userIdx] ?? 0;

    // Check all warnings
    warnings.forEach((w) => {
      if (w.lat == null || w.lon == null) return;
      // Never notify the traveller about their own report (anonymous included).
      if (w.username === (username || 'anonymous')) return;

      // Check if it is a medium or higher confidence warning
      if (w.severity !== 'medium' && w.severity !== 'high') return;

      // Find the warning's index in allPathCoords
      let wIdx = 0;
      let minWDist = Infinity;
      for (let i = 0; i < allPathCoords.length; i++) {
        const dist = haversineMeters([w.lat as number, w.lon as number], allPathCoords[i]);
        if (dist < minWDist) {
          minWDist = dist;
          wIdx = i;
        }
      }

      // If the warning is ahead of the traveler
      if (wIdx > userIdx) {
        const warningTime = pathTimes[wIdx] ?? 0;
        const timeToReach = warningTime - userTime;

        // If traveler is within 10 minutes of the warning
        if (timeToReach <= 10.0 && timeToReach > 0 && !notifiedUpcomingWarningIds.current.has(w.id)) {
          notifiedUpcomingWarningIds.current.add(w.id);

          const place = w.lat != null && w.lon != null ? nearestRouteStop(route, w.lat, w.lon) : null;
          const label = (w.title || '').replace(/\s+reported$/i, '').trim() || w.title;
          const where = place ? ` near ${cleanPlaceLabel(place, 'your route')}` : '';
          sendLocalNotification(
            'Upcoming warning on your journey',
            `${label}${where} in about ${Math.round(timeToReach)} min ahead.`
          ).catch((err) => console.warn('Failed to send upcoming warning notification:', err));
        }
      }
    });
  }, [simulating, liveCoords, userCoords, route, allPathCoords, pathTimes, warnings, username]);

  // Auto-play journey simulation
  useEffect(() => {
    if (!simulating || !isPlaying) return;
    const interval = setInterval(() => {
      setSimIndex((prev) => {
        if (prev < allPathCoords.length - 1) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, 1000 / simSpeed);
    return () => clearInterval(interval);
  }, [simulating, isPlaying, allPathCoords, simSpeed]);

  const cycleSpeed = () => {
    setSimSpeed((prev) => {
      if (prev === 0.5) return 1;
      if (prev === 1) return 2;
      if (prev === 2) return 4;
      return 0.5;
    });
  };

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
        const isOwn = w.username === (username || 'anonymous');
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
    const isInitialPan = !initialPanDone.current;
    const shouldPan = (isInitialPan || followUser) && mapReadyTick > 0;
    if (isInitialPan && mapReadyTick > 0) {
      initialPanDone.current = true;
    }

    if (Platform.OS === 'web') {
      const iframe = document.querySelector('iframe');
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'updateUserLocation', lat: userCoords[0], lon: userCoords[1], heading }, '*');
        if (shouldPan) {
          iframe.contentWindow.postMessage({ type: 'centerMapOnUser', lat: userCoords[0], lon: userCoords[1], animate: !isInitialPan }, '*');
        }
      }
    } else {
      if (webViewRef.current) {
        let js = `if (window.updateUserLocation) { window.updateUserLocation(${userCoords[0]}, ${userCoords[1]}, ${heading}); }`;
        if (shouldPan) {
          js += `if (window.centerMapOnUser) { window.centerMapOnUser(${userCoords[0]}, ${userCoords[1]}, ${!isInitialPan}); }`;
        }
        webViewRef.current.injectJavaScript(js);
      }
    }
  }, [userCoords, heading, mapReadyTick, followUser]);

  // Push the "hide change markers" state to the map (and re-push on map reload).
  useEffect(() => {
    if (Platform.OS === 'web') {
      const iframe = document.querySelector('iframe');
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'setChangeMarkersHidden', hidden: hideChanges }, '*');
      }
    } else if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.setChangeMarkersHidden) { window.setChangeMarkersHidden(${hideChanges}); } true;`,
      );
    }
  }, [hideChanges, mapReadyTick]);

  const handleMapMessage = (event: any) => {
    try {
      const dataStr = event.nativeEvent.data;
      const data = JSON.parse(dataStr);
      if (data.type === 'warningClick' && data.id) {
        openWarningById(data.id);
      } else if (data.type === 'warningClusterClick' && data.ids) {
        openClusterByIds(data.ids);
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
        respondedWarningIds.current.add(result.warning.id);
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
    return route ? buildJourneyMap(route, accents) : '';
  }, [route, accents]);

  if (!route) {
    return (
      <SafeAreaView style={[styles.screen, styles.emptyState, { backgroundColor: palette.background }]}>
        <Text style={[styles.emptyText, { color: palette.textPrimary }]}>No active journey.</Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/routes')}
          style={[styles.backBtnAction, { backgroundColor: CLEARWAY.blue }]}
        >
          <Text style={[styles.backBtnActionText, { color: CLEARWAY.white }]}>Routes</Text>
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

      {/* Top controls: Back (left); Hide changes + Hide warnings (right, inline) */}
      <View
        pointerEvents="box-none"
        style={[styles.topControls, { top: insets.top + 16 }]}
      >
        {/* Row 1: back button + compact 2×2 map key inline */}
        <View style={styles.topRow}>
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

          <View style={[styles.legendCard, { backgroundColor: '#f6f8fb', borderColor: palette.border }]}>
            <View style={styles.legendCol}>
              <View style={styles.legendRowItem}>
                <View style={[styles.legendDot, { backgroundColor: '#5b9d6b' }]} />
                <Text style={[styles.legendLabel, { color: palette.textPrimary }]}>Start</Text>
              </View>
              <View style={styles.legendRowItem}>
                <View style={[styles.legendDot, { backgroundColor: '#e23b3b' }]} />
                <Text style={[styles.legendLabel, { color: palette.textPrimary }]}>Destination</Text>
              </View>
            </View>
            <View style={styles.legendCol}>
              <View style={styles.legendRowItem}>
                <View style={styles.legendWalkDots}>
                  <View style={[styles.legendWalkDot, { backgroundColor: WALK_BLUE }]} />
                  <View style={[styles.legendWalkDot, { backgroundColor: WALK_BLUE }]} />
                  <View style={[styles.legendWalkDot, { backgroundColor: WALK_BLUE }]} />
                </View>
                <Text style={[styles.legendLabel, { color: palette.textPrimary }]}>Walking</Text>
              </View>
              <View style={styles.legendRowItem}>
                <View style={styles.legendEmojiStack}>
                  <View style={[styles.legendEmojiChip, { borderColor: palette.border }]}>
                    <Text style={styles.legendEmoji}>🚶</Text>
                  </View>
                  <View style={[styles.legendEmojiChip, styles.legendEmojiOverlap, { borderColor: palette.border }]}>
                    <Text style={styles.legendEmoji}>🚌</Text>
                  </View>
                  <View style={[styles.legendEmojiChip, styles.legendEmojiOverlap, { borderColor: palette.border }]}>
                    <Text style={styles.legendEmoji}>🚆</Text>
                  </View>
                </View>
                <Text style={[styles.legendLabel, { color: palette.textPrimary }]}>Changes</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Row 2: hide toggles, below the back button */}
        <View style={styles.topPillRow}>
          {/* Hide / show the white change markers */}
          <TouchableOpacity
            onPress={() => {
              analytics.trackClick();
              setHideChanges((v) => !v);
            }}
            style={[
              styles.topPill,
              { backgroundColor: hideChanges ? CLEARWAY.blueStrong : '#f6f8fb', borderColor: hideChanges ? CLEARWAY.blueStrong : palette.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel={hideChanges ? 'Show change icons on map' : 'Hide change icons from map'}
          >
            <Ionicons name={hideChanges ? 'bus-outline' : 'bus'} size={16} color={hideChanges ? CLEARWAY.white : palette.textPrimary} />
            <Text style={[styles.topPillText, { color: hideChanges ? CLEARWAY.white : palette.textPrimary }]}>
              {hideChanges ? 'Show changes' : 'Hide changes'}
            </Text>
          </TouchableOpacity>

          {/* Hide / show all warning markers */}
          <TouchableOpacity
            onPress={() => {
              analytics.trackClick();
              setHideAll(!hideAll);
            }}
            style={[
              styles.topPill,
              { backgroundColor: hideAll ? CLEARWAY.blueStrong : '#f6f8fb', borderColor: hideAll ? CLEARWAY.blueStrong : palette.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel={hideAll ? 'Show sensory warnings on map' : 'Hide sensory warnings from map'}
          >
            <Ionicons name={hideAll ? 'eye-off' : 'eye'} size={16} color={hideAll ? CLEARWAY.white : palette.textPrimary} />
            <Text style={[styles.topPillText, { color: hideAll ? CLEARWAY.white : palette.textPrimary }]}>
              {hideAll ? 'Show warnings' : 'Hide warnings'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Transient notice (e.g. duplicate report rejected) */}
      {reportNotice && (
        <View style={[styles.noticeBanner, { top: insets.top + 76, backgroundColor: CLEARWAY.blueStrong, borderColor: CLEARWAY.blueStrong }]}>
          <Ionicons name="information-circle-outline" size={16} color={CLEARWAY.white} />
          <Text style={[styles.noticeBannerText, { color: CLEARWAY.white }]}>{reportNotice}</Text>
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
        <View style={[styles.reportCapsuleHeaderPill, { backgroundColor: CLEARWAY.okay }]}>
          <Text style={[styles.reportCapsuleHeader, { color: CLEARWAY.heading }]}>Report</Text>
          <Text style={[styles.reportCapsuleHeader, { color: CLEARWAY.heading }]}>below</Text>
        </View>
        <View style={[styles.reportDivider, { backgroundColor: palette.divider }]} />
        {REPORT_OPTIONS.map((option) => {
          const selected = reportingType === option.type;
          return (
            <TouchableOpacity
              key={option.type}
              activeOpacity={0.85}
              onPress={() => {
                analytics.startDisruptionReport();
                setReportingType(option.type);
              }}
              style={[
                styles.reportCapsuleBtn,
                { backgroundColor: selected ? CLEARWAY.blueStrong : palette.surface },
              ]}
            >
              <Ionicons name={option.icon} size={16} color={selected ? CLEARWAY.white : palette.textPrimary} />
              <Text style={[styles.reportCapsuleLabel, { color: selected ? CLEARWAY.white : palette.textPrimary }]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Swipe-up journey sheet — collapsed shows duration·cost; swipe up for details */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.sheetPanel,
          {
            backgroundColor: GLASS.light.fill,
            borderColor: GLASS.light.border,
            height: SHEET_HEIGHT,
            transform: [{ translateY: panY }],
          },
        ]}
      >
        <BlurView intensity={GLASS.light.blur} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View
          style={[styles.sheetHeaderTouch, Platform.OS === 'web' ? ({ touchAction: 'none' } as any) : null]}
          {...headerPanResponder.panHandlers}>
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
                      <Text style={[styles.detailsStation, { color: palette.textPrimary }]}>
                        {cleanPlaceLabel(leg.departure, lIdx === 0 ? originFallback : 'This stop')}
                      </Text>
                      <Text style={[styles.detailsInstruction, { color: palette.textSecondary }]}>
                        {cleanInstruction(leg.instruction)} ({leg.duration_mins} mins)
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
                          <Text style={{ fontWeight: '800', color: palette.textPrimary }}>{cleanPlaceLabel(leg.arrival, lIdx === (route.legs?.length ?? 0) - 1 ? destinationFallback : 'the next stop')}</Text>
                        </Text>
                      </View>

                      {/* Intermediate stops along this leg (collapsible) — keeps the
                          live journey detail consistent with the pre-Go sheet. */}
                      {leg.stops && leg.stops.length > 0 && (
                        <View style={[styles.stopsDropdown, { borderLeftColor: CLEARWAY.blueStrong }]}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() =>
                              setStopsExpanded((prev) => ({ ...prev, [lIdx]: !prev[lIdx] }))
                            }
                            style={styles.stopsDropdownHeader}
                          >
                            <Text style={[styles.stopsHeader, { color: CLEARWAY.blueStrong }]}>
                              {stopsExpanded[lIdx] ? 'Hide' : 'Show'} {leg.stops.length} stop{leg.stops.length > 1 ? 's' : ''}
                            </Text>
                            <Ionicons
                              name={stopsExpanded[lIdx] ? 'chevron-up' : 'chevron-down'}
                              size={11}
                              color={CLEARWAY.blueStrong}
                              style={{ marginLeft: 4 }}
                            />
                          </TouchableOpacity>
                          {stopsExpanded[lIdx] && (
                            <View style={styles.stopsList}>
                              {leg.stops.map((stop, sIdx) => (
                                <Text key={sIdx} style={[styles.stopItemText, { color: palette.textMuted }]}>
                                  • {stop}
                                </Text>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
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
                      {cleanPlaceLabel(route.legs[route.legs.length - 1].arrival, destinationFallback)}
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
            <View style={[styles.reportInputPanel, { backgroundColor: '#eef1f5', borderColor: palette.border }]}>
              <TouchableOpacity
                onPress={() => {
                  analytics.trackClick();
                  setReportingType(null);
                  analytics.endDisruptionReport(null);
                }}
                style={[styles.reportCancelBtn, { backgroundColor: '#eef1f5', borderColor: palette.border }]}
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
                style={[styles.reportSubmitBtn, { backgroundColor: CLEARWAY.blue }]}
              >
                <Text style={[styles.reportSubmitBtnText, { color: CLEARWAY.white }]}>Submit</Text>
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
            <View style={[styles.warningCard, { backgroundColor: '#eef1f5', borderColor: palette.border }]}>
              <TouchableOpacity
                onPress={() => setSelectedWarning(null)}
                style={[styles.reportCancelBtn, { backgroundColor: '#eef1f5', borderColor: palette.border }]}
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
              <Text style={[styles.warningCardDesc, { color: palette.textSecondary }]}>{warningDisplayDesc(selectedWarning, username)}</Text>

              <TouchableOpacity
                onPress={() => (selectedIsOwn ? removeOwnWarning(selectedWarning) : dismissWarning(selectedWarning))}
                activeOpacity={0.85}
                style={[
                  styles.warningCardAction,
                  { backgroundColor: selectedIsOwn ? CLEARWAY.bad : CLEARWAY.blue },
                ]}
              >
                <Ionicons name={selectedIsOwn ? 'trash-outline' : 'eye-off-outline'} size={15} color={CLEARWAY.white} />
                <Text style={[styles.warningCardActionText, { color: CLEARWAY.white }]}>
                  {selectedIsOwn ? 'Remove' : 'Close'}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.warningCardHint, { color: palette.textMuted }]}>
                {selectedIsOwn ? 'Removes it from the map for everyone' : 'Hides it for you only'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Cluster breakdown — all sensory warnings in one ~100m area. */}
      {selectedCluster && (
        <View style={styles.reportOverlayRoot} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.reportBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedCluster(null)}
          />
          <View style={styles.reportCenterContainer} pointerEvents="box-none">
            <View style={[styles.warningCard, { backgroundColor: '#eef1f5', borderColor: palette.border }]}>
              <TouchableOpacity
                onPress={() => setSelectedCluster(null)}
                style={[styles.reportCancelBtn, { backgroundColor: '#eef1f5', borderColor: palette.border }]}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              >
                <Ionicons name="close" size={16} color={palette.textPrimary} />
              </TouchableOpacity>

              <Text style={[styles.warningCardTitle, { color: palette.textPrimary }]}>
                {selectedCluster.length} warnings here
              </Text>
              <ScrollView style={styles.clusterList} showsVerticalScrollIndicator={false}>
                {selectedCluster.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedCluster(null);
                      setSelectedWarning(w);
                    }}
                    style={styles.clusterRow}
                  >
                    <View
                      style={[
                        styles.clusterRowIcon,
                        { backgroundColor: warningVisual(w.icon, accents).color, borderColor: palette.border },
                      ]}
                    >
                      <Text style={{ fontSize: 15 }}>{warningVisual(w.icon, accents).emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.clusterRowTitle, { color: palette.textPrimary }]} numberOfLines={1}>
                        {w.title}
                      </Text>
                      <Text style={[styles.clusterRowDesc, { color: palette.textSecondary }]} numberOfLines={2}>
                        {warningDisplayDesc(w, username)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      )}

      {/* Proximity confirm prompt — shown when the traveller nears a warning */}
      {proximityWarning && (
        <View style={styles.reportOverlayRoot} pointerEvents="box-none">
          <View style={styles.reportBackdrop} pointerEvents="none" />
          <View style={styles.reportCenterContainer} pointerEvents="box-none">
            <View style={[styles.warningCard, { backgroundColor: '#eef1f5', borderColor: palette.border }]}>
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
                  style={[styles.proximityActionBtn, { backgroundColor: CLEARWAY.good }]}
                  accessibilityRole="button"
                  accessibilityLabel="Yes, still here"
                >
                  <Ionicons name="checkmark" size={16} color={CLEARWAY.white} />
                  <Text style={[styles.proximityActionText, { color: CLEARWAY.white }]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => respondProximity('no')}
                  activeOpacity={0.85}
                  style={[styles.proximityActionBtn, { backgroundColor: CLEARWAY.bad }]}
                  accessibilityRole="button"
                  accessibilityLabel="No, it's gone"
                >
                  <Ionicons name="close" size={16} color={CLEARWAY.white} />
                  <Text style={[styles.proximityActionText, { color: CLEARWAY.white }]}>No</Text>
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

      {/* Simulation / Journey Demo Player Panel */}
      <View
        style={{
          position: 'absolute',
          bottom: COLLAPSED_HEIGHT + 16,
          left: 16,
          zIndex: 10,
        }}
      >
        {!simulating ? (
          <TouchableOpacity
            onPress={() => {
              setSimulating(true);
              setSimIndex(0);
              setIsPlaying(true);
              setFollowUser(true);
            }}
            style={[
              styles.simStartBtn,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Start demo journey simulation"
          >
            <Ionicons name="play" size={16} color={accents.green} style={{ marginRight: 6 }} />
            <Text style={[styles.simStartText, { color: palette.textPrimary }]}>Simulate</Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.simControlRow,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            {/* Stop / Close Simulation */}
            <TouchableOpacity
              onPress={() => {
                setSimulating(false);
                setIsPlaying(false);
                setSimIndex(0);
              }}
              style={styles.simIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Exit simulation"
            >
              <Ionicons name="stop-circle-outline" size={22} color={CLEARWAY.bad} />
            </TouchableOpacity>

            {/* Step Back */}
            <TouchableOpacity
              onPress={() => {
                setIsPlaying(false);
                setSimIndex((prev) => Math.max(0, prev - 1));
              }}
              disabled={simIndex === 0}
              style={[styles.simIconBtn, simIndex === 0 && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel="Step simulation back"
            >
              <Ionicons name="chevron-back-outline" size={20} color={palette.textPrimary} />
            </TouchableOpacity>

            {/* Play / Pause Toggle */}
            <TouchableOpacity
              onPress={() => setIsPlaying((p) => !p)}
              style={styles.simIconBtn}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? "Pause simulation" : "Play simulation"}
            >
              <Ionicons name={isPlaying ? "pause-outline" : "play-outline"} size={20} color={palette.textPrimary} />
            </TouchableOpacity>

            {/* Step Forward */}
            <TouchableOpacity
              onPress={() => {
                setIsPlaying(false);
                setSimIndex((prev) => Math.min(allPathCoords.length - 1, prev + 1));
              }}
              disabled={simIndex === allPathCoords.length - 1}
              style={[styles.simIconBtn, simIndex === allPathCoords.length - 1 && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel="Step simulation forward"
            >
              <Ionicons name="chevron-forward-outline" size={20} color={palette.textPrimary} />
            </TouchableOpacity>

            {/* Speed Multiplier Button */}
            <TouchableOpacity
              onPress={cycleSpeed}
              style={[
                styles.simSpeedBtn,
                {
                  borderColor: palette.divider,
                  backgroundColor: palette.surface,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Change simulation speed. Current speed is ${simSpeed}x`}
            >
              <Text style={[styles.simSpeedText, { color: accents.orange }]}>{simSpeed}x</Text>
            </TouchableOpacity>

            {/* Progress Percentage */}
            <Text style={[styles.simText, { color: palette.textSecondary }]}>
              {allPathCoords.length > 0 ? Math.round(((simIndex + 1) / allPathCoords.length) * 100) : 0}%
            </Text>
          </View>
        )}
      </View>

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
  },
  topControls: {
    position: 'absolute',
    // `top` is applied inline as insets.top + 16 (see render) so the controls
    // clear the notch/status bar instead of being pinned to the screen edge.
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: 10,
  },
  topPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
  },
  topPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    borderWidth: 1,
    ...hardShadow(2),
  },
  topPillText: {
    fontSize: 11,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  // Compact 2×2 map key sitting inline beside the back button.
  legendCard: {
    flexShrink: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    ...hardShadow(1),
  },
  legendCol: {
    gap: 5,
  },
  legendRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },
  legendWalkDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    width: 13,
    justifyContent: 'center',
  },
  legendWalkDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 11.5,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
  },
  legendEmojiStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendEmojiChip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendEmojiOverlap: {
    marginLeft: -8,
  },
  legendEmoji: {
    fontSize: 10,
  },
  reportCapsuleHeaderPill: {
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 2,
    alignItems: 'center',
  },
  circleButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
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
    borderWidth: 1,
    ...hardShadow(3),
  },
  noticeBannerText: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '900',
  },
  reportCapsule: {
    position: 'absolute',
    // `top` applied inline as insets.top + 144 (see render).
    right: 16,
    width: 60,
    zIndex: 10,
    borderWidth: 1,
    borderRadius: 22,
    padding: 5,
    gap: 4,
    alignItems: 'center',
    ...hardShadow(3),
  },
  reportCapsuleHeader: {
    fontSize: 9.5,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
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
    borderWidth: 1,
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow(2),
  },
  reportTypeCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  reportTypeCircleText: {
    fontSize: 8,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    marginTop: 1,
  },
  reportSubmitBtn: {
    borderWidth: 1,
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
  },
  warningListEmoji: {
    fontSize: 22,
  },
  warningCard: {
    borderWidth: 1,
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCardTitle: {
    fontSize: 15,
    fontFamily: Fonts?.display,
    fontWeight: '900',
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
    borderWidth: 1,
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
  },
  warningCardHint: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  stopsDropdown: {
    marginTop: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    gap: 3,
  },
  stopsDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  stopsHeader: {
    fontSize: 11,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
  },
  stopsList: {
    gap: 2,
    marginTop: 2,
  },
  stopItemText: {
    fontSize: 11,
    fontFamily: Fonts?.body,
    fontWeight: '500',
  },
  clusterList: {
    alignSelf: 'stretch',
    maxHeight: 260,
    marginTop: 4,
  },
  clusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  clusterRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterRowTitle: {
    fontSize: 13,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
  },
  clusterRowDesc: {
    fontSize: 12,
    fontFamily: Fonts?.body,
    lineHeight: 16,
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
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    ...hardShadow(2),
  },
  proximityActionText: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '900',
  },
  detailsScrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    borderWidth: 1,
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
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...hardShadow(2),
  },
  backBtnActionText: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '900',
  },
  simControlRow: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
    ...hardShadow(3),
  },
  simIconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simText: {
    fontSize: 10,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    minWidth: 28,
    textAlign: 'center',
  },
  simSpeedBtn: {
    minWidth: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  simSpeedText: {
    fontSize: 9,
    fontFamily: Fonts?.display,
    fontWeight: '900',
  },
  simStartBtn: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    ...hardShadow(3),
  },
  simStartText: {
    fontSize: 10,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
