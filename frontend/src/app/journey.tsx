import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { AppState, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, Modal, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';

import { getLegUIProps } from '@/components/routes/route-card';
import { SensoryMeter } from '@/components/routes/sensory-meter';
import { Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getActiveJourneyRoute, requestReopenJourneyDetails } from '@/services/active-journey';
import { useRoutesService } from '@/services/services-context';
import { useAuth } from '@/context/auth-context';
import type { RouteOption, WarningItem } from '@/types/route';
import { analytics } from '@/services/analytics';

type SensoryReportType = 'sound' | 'heat' | 'smell' | 'crowds' | 'other';
type Accents = ReturnType<typeof getAccents>;

const REPORT_OPTIONS: {
  type: SensoryReportType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  emoji: string;
  accent: keyof Accents;
}[] = [
  { type: 'sound', label: 'Sound', icon: 'radio-outline', emoji: '🔊', accent: 'cyan' },
  { type: 'heat', label: 'Heat', icon: 'thermometer-outline', emoji: '🔥', accent: 'pink' },
  { type: 'smell', label: 'Smell', icon: 'flower-outline', emoji: '👃', accent: 'green' },
  { type: 'crowds', label: 'Crowds', icon: 'people-outline', emoji: '👥', accent: 'orange' },
  { type: 'other', label: 'Other', icon: 'add-circle-outline', emoji: '⚠️', accent: 'yellow' },
];

/**
 * Map a warning's stored `icon` (an Ionicon name, set when it was reported) to
 * the marker emoji and an accent-ramp colour, so journey markers stay readable
 * in both themes. Unknown icons fall back to the generic "other" look.
 */
function warningVisual(icon: string, accents: Accents): { emoji: string; color: string } {
  const option = REPORT_OPTIONS.find((o) => o.icon === icon) ?? REPORT_OPTIONS[REPORT_OPTIONS.length - 1];
  return { emoji: option.emoji, color: accents[option.accent] };
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
        
        const bounds = [${nodes.map((node) => `[${node.lat}, ${node.lon}]`).join(',')}];
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [45, 45] });

        // User Location marker (Yandex-style blue cone cursor)
        let userMarker = null;
        window.updateUserLocation = function(lat, lon, heading) {
          const iconHtml = \`
            <div style="position: relative; width: 30px; height: 30px; transform: rotate(\${heading}deg); transform-origin: center;">
              <!-- Heading cone -->
              <div style="position: absolute; top: -15px; left: 0; width: 0; height: 0; border-left: 15px solid transparent; border-right: 15px solid transparent; border-bottom: 25px solid rgba(0, 122, 255, 0.45); filter: blur(1px);"></div>
              <!-- Center cursor -->
              <div style="position: absolute; top: 5px; left: 5px; width: 20px; height: 20px; border-radius: 50%; background-color: #007aff; border: 3px solid #ffffff; box-shadow: 0 0 5px rgba(0,0,0,0.55);"></div>
            </div>
          \`;

          const userIcon = L.divIcon({
            html: iconHtml,
            className: 'user-location-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });

          if (!userMarker) {
            userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map);
          } else {
            userMarker.setLatLng([lat, lon]);
            userMarker.setIcon(userIcon);
          }
          map.panTo([lat, lon]);
        };

        // Warning markers (Waze-style sensory icons)
        let warningMarkers = {};
        window.updateWarnings = function(warningsJson) {
          const warnings = JSON.parse(warningsJson);
          
          // Remove old warning markers
          for (const id in warningMarkers) {
            map.removeLayer(warningMarkers[id]);
          }
          warningMarkers = {};

          warnings.forEach((w) => {
            if (w.lat == null || w.lon == null || w.hidden) return;

            const markerHtml = \`
              <div style="background-color: \${w.color}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid #1d1c1c; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-weight: bold; position: relative;">
                <span style="font-size: 16px;">\${w.emoji}</span>
              </div>
            \`;

            const warningIcon = L.divIcon({
              html: markerHtml,
              className: 'warning-marker-icon',
              iconSize: [36, 36],
              iconAnchor: [18, 18]
            });

            const marker = L.marker([w.lat, w.lon], { icon: warningIcon }).addTo(map);

            marker.on('click', function() {
              const msg = JSON.stringify({ type: 'warningClick', id: w.id });
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(msg);
              } else {
                window.parent.postMessage(msg, '*');
              }
            });
            
            warningMarkers[w.id] = marker;
          });
        };

        // Listen for postMessage updates from Web iframe
        window.addEventListener('message', function(event) {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.type === 'updateUserLocation') {
              window.updateUserLocation(data.lat, data.lon, data.heading);
            } else if (data.type === 'updateWarnings') {
              window.updateWarnings(data.warnings);
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
  const route = getActiveJourneyRoute();
  const routesService = useRoutesService();
  const { username } = useAuth();

  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);

  const webViewRef = useRef<WebView>(null);

  // States
  const [reportingType, setReportingType] = useState<SensoryReportType | null>(null);
  // Real user-reported warnings near this journey (no mocks, no live TfL items).
  const [warnings, setWarnings] = useState<WarningItem[]>([]);
  // Other users' warnings this user has closed — hidden locally only, never deleted.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  // The warning whose action card (Remove / Close) is currently open.
  const [selectedWarning, setSelectedWarning] = useState<WarningItem | null>(null);
  // Transient banner shown e.g. when a report is rejected as a near-duplicate.
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Latest warnings, readable from the map's (stale-closure) message handlers.
  const warningsRef = useRef<WarningItem[]>([]);
  useEffect(() => {
    warningsRef.current = warnings;
  }, [warnings]);

  // Open the action card for a tapped marker (looked up by id from the map).
  const openWarningById = useCallback((id: string) => {
    const warning = warningsRef.current.find((w) => w.id === id);
    if (warning) {
      analytics.trackWarningClick();
      setSelectedWarning(warning);
    }
  }, []);

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

  // Fetch the real, user-reported warnings near this journey. Live TfL/weather
  // warnings (no coordinates) are intentionally not placed on the journey map —
  // that's a separate story — so we keep only items reported by users.
  const loadingRef = useRef(false);
  const loadWarnings = useCallback(async () => {
    const activeRoute = route;
    if (!activeRoute || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const lineSet = new Set<string>();
      const stationSet = new Set<string>();
      activeRoute.legs?.forEach((leg) => {
        if (leg.line) lineSet.add(leg.line);
        if (leg.departure) stationSet.add(leg.departure);
        if (leg.arrival) stationSet.add(leg.arrival);
        leg.stops?.forEach((stop) => stationSet.add(stop));
      });

      const routeContext = {
        lines: Array.from(lineSet),
        stations: Array.from(stationSet),
      };

      const liveWarnings = await routesService.getWarnings(username || '', false, routeContext);

      // User reports are the only ones with a reporter and real coordinates.
      const userReports = liveWarnings.filter(
        (w) => w.username != null && w.lat != null && w.lon != null,
      );
      // Avoid re-rendering (and a marker flicker) when the set is unchanged.
      setWarnings((prev) => {
        const prevIds = new Set(prev.map((p) => p.id));
        const unchanged = prev.length === userReports.length && userReports.every((w) => prevIds.has(w.id));
        return unchanged ? prev : userReports;
      });
    } catch (e) {
      console.warn('Error loading route warnings:', e);
    } finally {
      loadingRef.current = false;
    }
  }, [route, routesService, username]);

  // Poll so warnings reported by others appear, and expired ones drop off.
  useEffect(() => {
    loadWarnings();
    const interval = setInterval(loadWarnings, 20000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadWarnings();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [loadWarnings]);

  // User location starts at the journey origin, facing the first leg.
  const userCoords = useMemo<[number, number]>(() => {
    return allPathCoords[0] || [51.5074, -0.1278];
  }, [allPathCoords]);

  const heading = useMemo(() => {
    if (allPathCoords.length < 2) return 0;
    return calculateHeading(allPathCoords[0], allPathCoords[1]);
  }, [allPathCoords]);

  // Sync state to Leaflet map
  const formattedWarnings = useMemo(() => {
    return warnings.map((w) => {
      const { emoji, color } = warningVisual(w.icon, accents);
      return {
        id: w.id,
        title: w.title,
        desc: w.desc,
        emoji,
        color,
        lat: w.lat,
        lon: w.lon,
        hidden: dismissedIds.has(w.id),
      };
    });
  }, [warnings, dismissedIds, accents]);

  useEffect(() => {
    const jsonString = JSON.stringify(formattedWarnings);
    if (Platform.OS === 'web') {
      const iframe = document.querySelector('iframe');
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'updateUserLocation', lat: userCoords[0], lon: userCoords[1], heading }, '*');
        iframe.contentWindow.postMessage({ type: 'updateWarnings', warnings: jsonString }, '*');
      }
    } else {
      if (webViewRef.current) {
        const js = `
          if (window.updateUserLocation) { window.updateUserLocation(${userCoords[0]}, ${userCoords[1]}, ${heading}); }
          if (window.updateWarnings) { window.updateWarnings('${jsonString.replace(/'/g, "\\'")}'); }
        `;
        webViewRef.current.injectJavaScript(js);
      }
    }
  }, [userCoords, heading, formattedWarnings]);

  const handleMapMessage = (event: any) => {
    try {
      const dataStr = event.nativeEvent.data;
      const data = JSON.parse(dataStr);
      if (data.type === 'warningClick' && data.id) {
        openWarningById(data.id);
      }
    } catch {
      // Ignore
    }
  };

  // Own warning: delete from the DB (gone for everyone). Optimistically drop it.
  const removeOwnWarning = async (warning: WarningItem) => {
    setSelectedWarning(null);
    setWarnings((prev) => prev.filter((w) => w.id !== warning.id));
    try {
      await routesService.deleteWarning(warning.id, username || 'anonymous');
    } catch (err) {
      console.warn('Failed to delete warning on backend:', err);
    }
  };

  // Someone else's warning: hide it for this user only, no API call.
  const dismissWarning = (warning: WarningItem) => {
    setSelectedWarning(null);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(warning.id);
      return next;
    });
  };

  const selectedIsOwn = !!selectedWarning && !!username && selectedWarning.username === username;

  // Actions — report a sensory warning at the (simulated) current location.
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

    try {
      const result = await routesService.reportWarning(body);
      if (result.duplicate) {
        setReportNotice('Already reported nearby');
      } else {
        setWarnings((prev) => [result.warning, ...prev]);
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

  const mapHtml = useMemo(() => (route ? buildJourneyMap(route, accents) : ''), [route, accents]);

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
          <iframe srcDoc={mapHtml} style={{ width: '100%', height: '100%', border: 'none' }} title="Journey Map" />
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            originWhitelist={['*']}
            domStorageEnabled={true}
            javaScriptEnabled={true}
            onMessage={handleMapMessage}
          />
        )}
      </View>

      {/* Top Left Navigation Icons (Back and Home) */}
      <View style={styles.topControls}>
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
      </View>

      {/* Transient notice (e.g. duplicate report rejected) */}
      {reportNotice && (
        <View style={[styles.noticeBanner, { backgroundColor: accents.yellow, borderColor: palette.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={palette.textPrimary} />
          <Text style={[styles.noticeBannerText, { color: palette.textPrimary }]}>{reportNotice}</Text>
        </View>
      )}

      {/* Grouped Right Capsule-style Rail — tap a type to report it here */}
      <View style={[styles.reportCapsule, { backgroundColor: palette.surface, borderColor: palette.border }]}>
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
            <Ionicons name={option.icon} size={18} color={palette.textPrimary} />
            <Text style={[styles.reportCapsuleLabel, { color: palette.textPrimary }]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom Information Trip Bar */}
      <View style={[styles.tripBar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => {
            analytics.trackClick();
            setDetailsVisible(true);
          }}
          style={[styles.tripActionBtn, { borderColor: palette.border, backgroundColor: accents.cyan }]}
          accessibilityRole="button"
          accessibilityLabel="Journey details"
        >
          <Ionicons name="list-outline" size={15} color={palette.textPrimary} />
          <Text style={[styles.tripActionBtnText, { color: palette.textPrimary }]}>DETAILS</Text>
        </TouchableOpacity>

        <View style={styles.tripRightBlock}>
          <Text style={[styles.tripDuration, { color: palette.textPrimary }]}>{route.duration} min</Text>
          <Text style={[styles.tripPrice, { color: palette.textSecondary }]}>£{route.price.toFixed(2)}</Text>
        </View>
      </View>

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

              <Text style={[styles.warningCardHint, { color: palette.textMuted }]}>
                {selectedIsOwn ? 'Removes it from the map for everyone' : 'Hides it for you only'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Journey Details Overlay — read sensory load & the full step list mid-trip */}
      <Modal
        visible={detailsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsVisible(false)}
      >
        <SafeAreaView style={[styles.overlayScreen, { backgroundColor: palette.surface }]}>
          <View style={styles.overlayHeader}>
            <TouchableOpacity
              onPress={() => {
                analytics.trackClick();
                setDetailsVisible(false);
              }}
              style={[styles.circleButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
              accessibilityRole="button"
              accessibilityLabel="Close journey details"
            >
              <Ionicons name="arrow-back" size={20} color={palette.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.overlayTitle, { color: palette.textPrimary }]} numberOfLines={1}>
                {route.name}
              </Text>
              {route.subName ? (
                <Text style={[styles.detailsSubtitle, { color: palette.textSecondary }]} numberOfLines={1}>
                  {route.subName}
                </Text>
              ) : null}
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.detailsScrollContent} showsVerticalScrollIndicator={false}>
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
        </SafeAreaView>
      </Modal>
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
    top: Platform.OS === 'ios' ? 16 : 36,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow(3),
  },
  noticeBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 76 : 96,
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
    top: Platform.OS === 'ios' ? 144 : 164,
    right: 16,
    zIndex: 10,
    borderWidth: 2.5,
    borderRadius: 22,
    padding: 6,
    gap: 4,
    ...hardShadow(3),
  },
  reportCapsuleBtn: {
    width: 60,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  reportCapsuleLabel: {
    fontSize: 8,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tripBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    zIndex: 10,
    borderWidth: 3,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...hardShadow(5),
  },
  tripActionBtn: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...hardShadow(2),
  },
  tripActionBtnText: {
    fontSize: 10,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tripRightBlock: {
    alignItems: 'flex-end',
  },
  tripDuration: {
    fontSize: 13,
    fontFamily: Fonts?.display,
    fontWeight: '900',
  },
  tripPrice: {
    fontSize: 9,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    marginTop: 1,
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
  overlayScreen: {
    flex: 1,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 32,
    paddingBottom: 12,
    gap: 14,
  },
  overlayTitle: {
    fontSize: 18,
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
  detailsSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
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
});
