import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, Modal, ScrollView, Animated } from 'react-native';
import { WebView } from 'react-native-webview';

import { getLegUIProps } from '@/components/routes/route-card';
import { Fonts, getAccents, getPalette, getSemanticColors, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getActiveJourneyRoute } from '@/services/active-journey';
import { useRoutesService } from '@/services/services-context';
import { useAuth } from '@/context/auth-context';
import type { RouteOption, WarningItem } from '@/types/route';

type SensoryReportType = 'sound' | 'heat' | 'smell' | 'crowds' | 'other';

const REPORT_OPTIONS: {
  type: SensoryReportType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  emoji: string;
  color: string;
}[] = [
  { type: 'sound', label: 'Sound', icon: 'radio-outline', emoji: '🔊', color: '#7af7f7' },
  { type: 'heat', label: 'Heat', icon: 'thermometer-outline', emoji: '🔥', color: '#ff158a' },
  { type: 'smell', label: 'Smell', icon: 'flower-outline', emoji: '👃', color: '#83f582' },
  { type: 'crowds', label: 'Crowds', icon: 'people-outline', emoji: '👥', color: '#fdad70' },
  { type: 'other', label: 'Other', icon: 'add-circle-outline', emoji: '⚠️', color: '#fff48d' },
];

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

            const marker = L.marker([w.lat, w.lon], { icon: warningIcon })
              .addTo(map)
              .bindPopup(\`<b>\${w.title}</b><br/>\${w.desc}\`);
            
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
  const semantic = getSemanticColors(isDark);

  const webViewRef = useRef<WebView>(null);

  // States
  const [reportingType, setReportingType] = useState<SensoryReportType | null>(null);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [warningsSettings, setWarningsSettings] = useState<Record<string, { showOnMap: boolean; avoidReroute: boolean }>>({});
  const [warningsModalVisible, setWarningsModalVisible] = useState(false);
  const [confirmingWarning, setConfirmingWarning] = useState<any | null>(null);
  const [confirmedWarningIds, setConfirmedWarningIds] = useState<Set<string>>(new Set());

  // Simulation state
  const [currentPathIndex, setCurrentPathIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

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

  // Fetch / initialize warnings
  useEffect(() => {
    async function loadWarnings() {
      const activeRoute = route;
      if (!activeRoute) return;
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

        const initialWarnings = [
          {
            id: 'w_mock_piccadilly',
            title: 'Piccadilly line, Port closure',
            desc: 'Short description of impacts i.e. Bus services delayed',
            severity: 'high',
            icon: 'alert-circle',
            emoji: '❌',
            color: accents.pink,
            lat: null,
            lon: null,
          },
          {
            id: 'w_mock_protest',
            title: 'Protest at SK, ~2000 people',
            desc: 'Short description of impacts i.e. Bus services affected',
            severity: 'high',
            icon: 'people',
            emoji: '👥',
            color: accents.orange,
            lat: null,
            lon: null,
          },
          {
            id: 'w_mock_forest',
            title: 'Forest, No vehicles found',
            desc: 'No vehicles found right now',
            severity: 'info',
            icon: 'warning',
            emoji: '⚠️',
            color: accents.yellow,
            lat: null,
            lon: null,
          },
          ...liveWarnings.map((w) => ({
            ...w,
            emoji: w.icon === 'thermometer' ? '🔥' : w.icon === 'volume-high' ? '🔊' : '⚠️',
            color: w.icon === 'thermometer' ? accents.pink : w.icon === 'volume-high' ? accents.cyan : accents.yellow,
            lat: null,
            lon: null,
          })),
        ];

        // Map warnings along path
        const mapped = initialWarnings.map((w, index) => {
          let lat = null,
            lon = null;
          if (activeRoute.legs) {
            for (const leg of activeRoute.legs) {
              if (leg.departure && w.title.toLowerCase().includes(leg.departure.toLowerCase())) {
                lat = leg.departure_lat;
                lon = leg.departure_lon;
                break;
              }
              if (leg.arrival && w.title.toLowerCase().includes(leg.arrival.toLowerCase())) {
                lat = leg.arrival_lat;
                lon = leg.arrival_lon;
                break;
              }
            }
          }

          if (lat == null && allPathCoords.length > 0) {
            const ratio = (index + 1) / (initialWarnings.length + 1);
            const coordIndex = Math.floor(allPathCoords.length * ratio);
            const pt = allPathCoords[coordIndex] || allPathCoords[0];
            lat = pt[0];
            lon = pt[1];
          }

          return { ...w, lat, lon };
        });

        setWarnings(mapped);
      } catch (e) {
        console.warn('Error loading route warnings:', e);
        if (allPathCoords.length > 0) {
          const fallbacks = [
            {
              id: 'w_mock_piccadilly',
              title: 'Piccadilly line, Port closure',
              desc: 'Short description of impacts i.e. Bus services delayed',
              severity: 'high',
              icon: 'alert-circle',
              emoji: '❌',
              color: accents.pink,
              lat: allPathCoords[Math.floor(allPathCoords.length * 0.3)][0],
              lon: allPathCoords[Math.floor(allPathCoords.length * 0.3)][1],
            },
            {
              id: 'w_mock_protest',
              title: 'Protest at SK, ~2000 people',
              desc: 'Short description of impacts i.e. Bus services affected',
              severity: 'high',
              icon: 'people',
              emoji: '👥',
              color: accents.orange,
              lat: allPathCoords[Math.floor(allPathCoords.length * 0.6)][0],
              lon: allPathCoords[Math.floor(allPathCoords.length * 0.6)][1],
            },
            {
              id: 'w_mock_forest',
              title: 'Forest, No vehicles found',
              desc: 'No vehicles found right now',
              severity: 'info',
              icon: 'warning',
              emoji: '⚠️',
              color: accents.yellow,
              lat: allPathCoords[Math.floor(allPathCoords.length * 0.8)][0],
              lon: allPathCoords[Math.floor(allPathCoords.length * 0.8)][1],
            },
          ];
          setWarnings(fallbacks);
        }
      }
    }

    loadWarnings();
  }, [route, allPathCoords]);

  // Current coordinate & heading calculations
  const userCoords = useMemo<[number, number]>(() => {
    return allPathCoords[currentPathIndex] || [51.5074, -0.1278];
  }, [currentPathIndex, allPathCoords]);

  const heading = useMemo(() => {
    if (currentPathIndex === 0 || allPathCoords.length < 2) return 0;
    const prev = allPathCoords[currentPathIndex - 1];
    const curr = allPathCoords[currentPathIndex];
    if (!prev || !curr) return 0;
    return calculateHeading(prev, curr);
  }, [currentPathIndex, allPathCoords]);

  // Sync state to Leaflet map
  const formattedWarnings = useMemo(() => {
    return warnings.map((w) => ({
      id: w.id,
      title: w.title,
      desc: w.desc,
      emoji: w.emoji,
      color: w.color,
      lat: w.lat,
      lon: w.lon,
      hidden: warningsSettings[w.id]?.showOnMap === false,
    }));
  }, [warnings, warningsSettings]);

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

  // Simulation timer loop
  useEffect(() => {
    if (!isPlaying || allPathCoords.length === 0) return;

    const interval = setInterval(() => {
      setCurrentPathIndex((prevIndex) => {
        if (prevIndex >= allPathCoords.length - 1) {
          setIsPlaying(false);
          return prevIndex;
        }
        const nextIndex = prevIndex + 1;
        const nextCoords = allPathCoords[nextIndex];

        if (nextCoords) {
          // Check proximity to warning markers
          const nearbyWarning = warnings.find((w) => {
            if (w.lat == null || w.lon == null || confirmedWarningIds.has(w.id)) return false;
            if (warningsSettings[w.id]?.showOnMap === false) return false;

            const dLat = nextCoords[0] - w.lat;
            const dLon = nextCoords[1] - w.lon;
            const dist = Math.sqrt(dLat * dLat + dLon * dLon);
            return dist < 0.0006; // roughly 50m
          });

          if (nearbyWarning) {
            setIsPlaying(false);
            setConfirmingWarning(nearbyWarning);
          }
        }

        return nextIndex;
      });
    }, 1500); // Step every 1.5 seconds

    return () => clearInterval(interval);
  }, [isPlaying, allPathCoords, warnings, confirmedWarningIds, warningsSettings]);

  // Route identifier & walking duration calculations
  const routeInfo = useMemo(() => {
    if (!route) return { name: 'Walk', walkTime: 0 };
    let name = 'Walk';
    let walkTime = 0;
    route.legs?.forEach((leg) => {
      const mode = leg.mode.toLowerCase();
      if (mode === 'walking' || mode === 'walk') {
        walkTime += leg.duration_mins;
      } else {
        name = leg.line || leg.mode.toUpperCase();
      }
    });
    return { name, walkTime };
  }, [route]);

  const activeWarningsCount = useMemo(() => {
    return warnings.filter((w) => warningsSettings[w.id]?.showOnMap !== false).length;
  }, [warnings, warningsSettings]);

  // Actions
  const submitReport = () => {
    if (!reportingType) return;
    const option = REPORT_OPTIONS.find((o) => o.type === reportingType);
    if (!option) return;

    const newReport = {
      id: `w_user_${Date.now()}`,
      title: `${option.label} Warning`,
      desc: `User reported sensory warning (${option.label.toLowerCase()}) at current location.`,
      severity: 'medium',
      icon: option.icon,
      emoji: option.emoji,
      color: option.color,
      lat: userCoords[0],
      lon: userCoords[1],
    };

    setWarnings((prev) => [newReport, ...prev]);
    setReportingType(null);
  };

  const handleConfirmStillThere = (stillThere: boolean) => {
    if (!confirmingWarning) return;
    if (stillThere) {
      setConfirmedWarningIds((prev) => {
        const next = new Set(prev);
        next.add(confirmingWarning.id);
        return next;
      });
    } else {
      // Remove warning entirely on "NO"
      setWarnings((prev) => prev.filter((w) => w.id !== confirmingWarning.id));
    }
    setConfirmingWarning(null);
    setIsPlaying(true); // Resume simulation
  };

  // Check if any warning is avoiding / rerouting
  const avoidingWarningsCount = useMemo(() => {
    return Object.values(warningsSettings).filter((s) => s.avoidReroute).length;
  }, [warningsSettings]);

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
          />
        )}
      </View>

      {/* Top Left Navigation Icons (Back and Home) */}
      <View style={styles.topControls}>
        <View style={styles.navButtonsRow}>
          <TouchableOpacity
            onPress={() => router.back()}
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

        <View style={[styles.activeBadge, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Ionicons name="navigate" size={14} color={palette.textPrimary} />
          <Text style={[styles.activeBadgeText, { color: palette.textPrimary }]}>Journey active</Text>
        </View>
      </View>

      {/* Rerouted Indicator Banner */}
      {avoidingWarningsCount > 0 && (
        <View style={[styles.rerouteBanner, { backgroundColor: semantic.warningSurface, borderColor: semantic.warningBorder }]}>
          <Ionicons name="shuffle-outline" size={16} color={semantic.warningIcon} />
          <Text style={[styles.rerouteBannerText, { color: semantic.warningText }]}>
            Rerouted: Avoiding {avoidingWarningsCount} warning{avoidingWarningsCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Grouped Right Capsule-style Rail */}
      <View style={[styles.reportCapsule, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {REPORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.type}
            activeOpacity={0.85}
            onPress={() => setReportingType(option.type)}
            style={[
              styles.reportCapsuleBtn,
              {
                backgroundColor: reportingType === option.type ? option.color : palette.surface,
              },
            ]}
          >
            <Ionicons name={option.icon} size={18} color={palette.textPrimary} />
            <Text style={[styles.reportCapsuleLabel, { color: palette.textPrimary }]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Simulation Controls Overlay */}
      <View style={[styles.simControls, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.simTitle, { color: palette.textMuted }]}>Journey Simulation</Text>
        <View style={styles.simButtonsRow}>
          <TouchableOpacity
            onPress={() => setIsPlaying(!isPlaying)}
            style={[styles.simActionBtn, { backgroundColor: isPlaying ? accents.pink : accents.green, borderColor: palette.border }]}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color={palette.textPrimary} />
            <Text style={[styles.simActionBtnText, { color: palette.textPrimary }]}>
              {isPlaying ? 'Pause' : 'Play'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setCurrentPathIndex((prev) => Math.min(prev + 5, allPathCoords.length - 1));
            }}
            style={[styles.simActionBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Ionicons name="play-forward" size={14} color={palette.textPrimary} />
            <Text style={[styles.simActionBtnText, { color: palette.textPrimary }]}>+5 Steps</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setCurrentPathIndex(0);
              setIsPlaying(false);
              setConfirmedWarningIds(new Set());
            }}
            style={[styles.simActionBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Ionicons name="refresh" size={14} color={palette.textPrimary} />
            <Text style={[styles.simActionBtnText, { color: palette.textPrimary }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Track */}
        <View style={styles.progressTrackContainer}>
          <View style={[styles.progressTrackBg, { backgroundColor: palette.divider }]} />
          <View
            style={[
              styles.progressTrackFill,
              {
                backgroundColor: accents.pink,
                width: allPathCoords.length > 0 ? `${(currentPathIndex / (allPathCoords.length - 1)) * 100}%` : '0%',
              },
            ]}
          />
          <Text style={[styles.progressText, { color: palette.textMuted }]}>
            {allPathCoords.length > 0 ? Math.round((currentPathIndex / (allPathCoords.length - 1)) * 100) : 0}% Traveled
          </Text>
        </View>
      </View>

      {/* Bottom Information Trip Bar */}
      <View style={[styles.tripBar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.tripLeftBlock}>
          <View style={[styles.infoPill, { backgroundColor: accents.yellow, borderColor: palette.border }]}>
            <Text style={[styles.infoPillText, { color: palette.textPrimary }]}>{routeInfo.name}</Text>
          </View>
          <View style={[styles.infoPill, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Ionicons name="walk" size={13} color={palette.textPrimary} />
            <Text style={[styles.infoPillText, { color: palette.textPrimary }]}>{routeInfo.walkTime}m</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setWarningsModalVisible(true)}
          style={[styles.warningsToggleBtn, { borderColor: accents.orange }]}
        >
          <Ionicons name="warning-outline" size={15} color={accents.orange} />
          <Text style={[styles.warningsToggleBtnText, { color: palette.textPrimary }]}>
            WARNINGS ({activeWarningsCount})
          </Text>
        </TouchableOpacity>

        <View style={styles.tripRightBlock}>
          <Text style={[styles.tripDuration, { color: palette.textPrimary }]}>{route.duration} min</Text>
          <Text style={[styles.tripPrice, { color: palette.textSecondary }]}>£{route.price.toFixed(2)}</Text>
        </View>
      </View>

      {/* Waze style reporting action bar */}
      {reportingType && activeReport && (
        <View style={[styles.reportInputPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <TouchableOpacity
            onPress={() => setReportingType(null)}
            style={[styles.reportCancelBtn, { backgroundColor: accents.pink, borderColor: palette.border }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel report"
          >
            <Ionicons name="close" size={16} color={palette.textPrimary} />
          </TouchableOpacity>

          <View style={[styles.reportTypeCircle, { backgroundColor: activeReport.color, borderColor: palette.border }]}>
            <Ionicons name={activeReport.icon} size={26} color={palette.textPrimary} />
            <Text style={[styles.reportTypeCircleText, { color: palette.textPrimary }]}>{activeReport.label}</Text>
          </View>

          <TouchableOpacity
            onPress={submitReport}
            activeOpacity={0.85}
            style={[styles.reportSubmitBtn, { backgroundColor: accents.green, borderColor: palette.border }]}
          >
            <Text style={[styles.reportSubmitBtnText, { color: palette.textPrimary }]}>Submit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Proximity Dialog: Asked to confirm still there? */}
      {confirmingWarning && (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalBackdrop} />
          <View style={styles.confirmDialogContainer}>
            <View style={[styles.confirmDialogCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={[styles.confirmIconHeader, { backgroundColor: confirmingWarning.color, borderColor: palette.border }]}>
                <Text style={styles.confirmIconEmoji}>{confirmingWarning.emoji}</Text>
              </View>

              <Text style={[styles.confirmTitle, { color: palette.textPrimary }]}>
                {confirmingWarning.title}
              </Text>
              <Text style={[styles.confirmSubtitle, { color: palette.textSecondary }]}>
                Last reported ~20 min ago. Still there?
              </Text>

              <View style={styles.confirmButtonsRow}>
                <TouchableOpacity
                  onPress={() => handleConfirmStillThere(true)}
                  style={[styles.confirmAnswerBtn, { backgroundColor: accents.green, borderColor: palette.border }]}
                >
                  <Ionicons name="checkmark-sharp" size={16} color={palette.textPrimary} />
                  <Text style={[styles.confirmAnswerBtnText, { color: palette.textPrimary }]}>YES</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleConfirmStillThere(false)}
                  style={[styles.confirmAnswerBtn, { backgroundColor: accents.pink, borderColor: palette.border }]}
                >
                  <Ionicons name="close-sharp" size={16} color={palette.textPrimary} />
                  <Text style={[styles.confirmAnswerBtnText, { color: palette.textPrimary }]}>NO</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setConfirmedWarningIds((prev) => {
                    const next = new Set(prev);
                    next.add(confirmingWarning.id);
                    return next;
                  });
                  setConfirmingWarning(null);
                  setIsPlaying(true);
                }}
                style={[styles.confirmSkipBtn, { backgroundColor: palette.divider, borderColor: palette.border }]}
              >
                <Text style={[styles.confirmSkipBtnText, { color: palette.textPrimary }]}>SKIP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Select Warnings Modal List Overlay */}
      <Modal
        visible={warningsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setWarningsModalVisible(false)}
      >
        <SafeAreaView style={[styles.overlayScreen, { backgroundColor: palette.surface }]}>
          {/* Header controls inside the overlay */}
          <View style={styles.overlayHeader}>
            <View style={styles.navButtonsRow}>
              <TouchableOpacity
                onPress={() => setWarningsModalVisible(false)}
                style={[styles.circleButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
              >
                <Ionicons name="arrow-back" size={20} color={palette.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setWarningsModalVisible(false);
                  router.replace('/(tabs)/routes');
                }}
                style={[styles.circleButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
              >
                <Ionicons name="home-outline" size={20} color={palette.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.overlayTitle, { color: palette.textPrimary }]}>Select warning</Text>
          </View>

          {/* Warnings List */}
          <ScrollView contentContainerStyle={styles.overlayListContainer} showsVerticalScrollIndicator={false}>
            {warnings.length === 0 ? (
              <Text style={[styles.emptyWarningsText, { color: palette.textMuted }]}>
                No warnings active for this journey.
              </Text>
            ) : (
              warnings.map((w) => {
                const setting = warningsSettings[w.id] || { showOnMap: true, avoidReroute: false };
                return (
                  <View key={w.id} style={[styles.warningListCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                    <View style={[styles.warningListIconCircle, { backgroundColor: w.color, borderColor: palette.border }]}>
                      <Text style={styles.warningListEmoji}>{w.emoji}</Text>
                    </View>

                    <View style={styles.warningListInfo}>
                      <Text style={[styles.warningListTitle, { color: palette.textPrimary }]}>{w.title}</Text>
                      <Text style={[styles.warningListDesc, { color: palette.textSecondary }]}>
                        &gt; {w.desc}
                      </Text>
                    </View>

                    {/* Actions block (Show on map / Avoid) */}
                    <View style={styles.warningListActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setWarningsSettings((prev) => ({
                            ...prev,
                            [w.id]: {
                              ...setting,
                              showOnMap: !setting.showOnMap,
                            },
                          }));
                        }}
                        style={[
                          styles.listActionCheckbox,
                          {
                            borderColor: palette.border,
                            backgroundColor: setting.showOnMap ? accents.green : palette.divider,
                          },
                        ]}
                      >
                        <Ionicons name="map-outline" size={14} color={palette.textPrimary} />
                        {setting.showOnMap && <Ionicons name="checkmark" size={10} color={palette.textPrimary} style={styles.checkMini} />}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setWarningsSettings((prev) => ({
                            ...prev,
                            [w.id]: {
                              ...setting,
                              avoidReroute: !setting.avoidReroute,
                            },
                          }));
                        }}
                        style={[
                          styles.listActionCheckbox,
                          {
                            borderColor: palette.border,
                            backgroundColor: setting.avoidReroute ? accents.orange : palette.divider,
                          },
                        ]}
                      >
                        <Ionicons name="close-circle-outline" size={14} color={palette.textPrimary} />
                        {setting.avoidReroute && <Ionicons name="checkmark" size={10} color={palette.textPrimary} style={styles.checkMini} />}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity
            onPress={() => setWarningsModalVisible(false)}
            style={[styles.closeOverlayBtn, { backgroundColor: accents.green, borderColor: palette.border }]}
          >
            <Text style={[styles.closeOverlayBtnText, { color: palette.textPrimary }]}>Apply</Text>
          </TouchableOpacity>
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
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...hardShadow(3),
  },
  activeBadgeText: {
    fontSize: 10,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  rerouteBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 76 : 96,
    left: 16,
    right: 16,
    zIndex: 9,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 2,
    gap: 8,
    ...hardShadow(2),
  },
  rerouteBannerText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Fonts?.body,
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
  simControls: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    zIndex: 10,
    borderWidth: 2.5,
    borderRadius: 18,
    padding: 12,
    ...hardShadow(4),
  },
  simTitle: {
    fontSize: 9,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  simButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 8,
  },
  simActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
    flex: 1,
    ...hardShadow(2),
  },
  simActionBtnText: {
    fontSize: 10,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  progressTrackContainer: {
    marginTop: 12,
    position: 'relative',
    height: 24,
    justifyContent: 'center',
  },
  progressTrackBg: {
    height: 8,
    borderRadius: 4,
    width: '100%',
  },
  progressTrackFill: {
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    left: 0,
  },
  progressText: {
    fontSize: 8.5,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'right',
    marginTop: 4,
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
  tripLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoPill: {
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  infoPillText: {
    fontSize: 10,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  warningsToggleBtn: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...hardShadow(2),
  },
  warningsToggleBtnText: {
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
  reportInputPanel: {
    position: 'absolute',
    left: 16,
    bottom: 96,
    zIndex: 25,
    borderWidth: 3,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: 240,
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
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99,
  },
  confirmDialogContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 24,
  },
  confirmDialogCard: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 3,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    ...hardShadow(6),
  },
  confirmIconHeader: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...hardShadow(2),
  },
  confirmIconEmoji: {
    fontSize: 26,
  },
  confirmTitle: {
    fontSize: 15,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 6,
  },
  confirmSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 18,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 10,
  },
  confirmAnswerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 2.5,
    borderRadius: 12,
    paddingVertical: 12,
    flex: 1,
    ...hardShadow(2),
  },
  confirmAnswerBtnText: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '900',
  },
  confirmSkipBtn: {
    width: '100%',
    borderWidth: 2.5,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...hardShadow(2),
  },
  confirmSkipBtnText: {
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
  overlayListContainer: {
    padding: 16,
    gap: 14,
  },
  emptyWarningsText: {
    textAlign: 'center',
    paddingVertical: 36,
    fontSize: 12,
  },
  warningListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
    ...hardShadow(2),
  },
  warningListIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningListEmoji: {
    fontSize: 18,
  },
  warningListInfo: {
    flex: 1,
  },
  warningListTitle: {
    fontSize: 13,
    fontFamily: Fonts?.display,
    fontWeight: '900',
  },
  warningListDesc: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 2,
  },
  warningListActions: {
    flexDirection: 'row',
    gap: 6,
  },
  listActionCheckbox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  checkMini: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    padding: 1,
  },
  closeOverlayBtn: {
    margin: 16,
    borderWidth: 2.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow(3),
  },
  closeOverlayBtnText: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
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
