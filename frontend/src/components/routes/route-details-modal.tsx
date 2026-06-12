import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { getLegUIProps } from '@/components/routes/route-card';
import { SensoryMeter } from '@/components/routes/sensory-meter';
import { WarningConfidence } from '@/components/routes/warning-confidence';
import { warningMarkerScript, warningVisual } from '@/components/routes/warning-markers';
import { Fonts, getAccents, getPalette, getSemanticColors, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouteWarnings } from '@/hooks/use-route-warnings';
import { setActiveJourneyRoute } from '@/services/active-journey';
import type { RouteOption } from '@/types/route';
import { analytics } from '@/services/analytics';

interface RouteDetailsModalProps {
  visible: boolean;
  route: RouteOption | null;
  onClose: () => void;
}

export function RouteDetailsModal({ visible, route, onClose }: RouteDetailsModalProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const semantic = getSemanticColors(isDark);
  const linkColor = semantic.link;

  // User-reported warnings on the pre-Go map — same source, markers and
  // remove/hide actions as the live journey. Poll only while the sheet is open.
  const {
    formattedWarnings,
    selectedWarning,
    setSelectedWarning,
    openWarningById,
    selectedIsOwn,
    removeOwnWarning,
    dismissWarning,
    hideAll,
    setHideAll,
  } = useRouteWarnings(route, accents, visible);

  const webViewRef = React.useRef<WebView>(null);
  // Bumped when the map iframe/WebView finishes loading, so the marker-sync
  // effect re-pushes once the map can receive messages (the first push races the
  // async map load and is otherwise dropped — markers wouldn't show until the
  // user toggled the hide button).
  const [mapReadyTick, setMapReadyTick] = React.useState(0);

  const [stopsExpanded, setStopsExpanded] = useState<Record<number, boolean>>({});

  // Push the latest markers to the map, and listen for marker taps coming back.
  React.useEffect(() => {
    if (!visible) return;
    const jsonString = JSON.stringify(formattedWarnings);
    if (Platform.OS === 'web') {
      const iframe = document.querySelector('iframe');
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'updateWarnings', warnings: jsonString }, '*');
      }
    } else if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.updateWarnings) { window.updateWarnings('${jsonString.replace(/'/g, "\\'")}'); } true;`,
      );
    }
  }, [visible, formattedWarnings, mapReadyTick]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
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
    window.addEventListener('message', handleWebMessage);
    return () => window.removeEventListener('message', handleWebMessage);
  }, [openWarningById]);

  // Bottom Sheet animations and dimensions
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;
  const COLLAPSED_HEIGHT = 105;
  const MAX_TRANSLATE_Y = SHEET_HEIGHT - COLLAPSED_HEIGHT;

  const panY = React.useRef(new Animated.Value(MAX_TRANSLATE_Y)).current;
  const lastTranslateY = React.useRef(MAX_TRANSLATE_Y);
  const startTranslateY = React.useRef(MAX_TRANSLATE_Y);
  // Current scroll offset of the inner list, so a downward drag at the very top
  // collapses the sheet instead of being swallowed by the ScrollView.
  const scrollOffsetY = React.useRef(0);

  React.useEffect(() => {
    const listenerId = panY.addListener(({ value }) => {
      lastTranslateY.current = value;
    });
    return () => {
      panY.removeListener(listenerId);
    };
  }, [panY]);

  React.useEffect(() => {
    if (visible) {
      panY.setValue(MAX_TRANSLATE_Y);
      lastTranslateY.current = MAX_TRANSLATE_Y;
    }
  }, [visible, route, panY, MAX_TRANSLATE_Y]);

  const onPanResponderGrant = () => {
    startTranslateY.current = lastTranslateY.current;
    panY.setOffset(startTranslateY.current);
    panY.setValue(0);
  };

  const onPanResponderMove = (_: any, gestureState: any) => {
    const newY = gestureState.dy;
    const minVal = -startTranslateY.current;
    const maxVal = MAX_TRANSLATE_Y - startTranslateY.current;
    panY.setValue(Math.max(minVal, Math.min(maxVal, newY)));
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
      const halfway = MAX_TRANSLATE_Y / 2;
      if (currentY < halfway) {
        targetY = 0;
      } else {
        targetY = MAX_TRANSLATE_Y;
      }
    }
    
    Animated.spring(panY, {
      toValue: targetY,
      useNativeDriver: Platform.OS !== 'web',
      tension: 50,
      friction: 8,
    }).start();
  };

  const headerPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant,
      onPanResponderMove,
      onPanResponderRelease,
      onPanResponderTerminate: () => {},
    })
  ).current;

  const sheetPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dy, dx } = gestureState;
        const verticalEnough = Math.abs(dy) > 4 && Math.abs(dy) > Math.abs(dx);
        if (!verticalEnough) return false;
        
        // If dragging down and at the top of the scroll view, claim it
        if (dy > 0 && scrollOffsetY.current <= 0) {
          return true;
        }
        // If dragging up and not fully expanded, claim it so we expand
        if (dy < 0 && lastTranslateY.current > 1) {
          return true;
        }
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const { dy, dx } = gestureState;
        const verticalEnough = Math.abs(dy) > 4 && Math.abs(dy) > Math.abs(dx);
        if (!verticalEnough) return false;
        
        // If dragging down and at the top of the scroll view, capture it
        if (dy > 0 && scrollOffsetY.current <= 0) {
          return true;
        }
        // If dragging up and not fully expanded, capture it
        if (dy < 0 && lastTranslateY.current > 1) {
          return true;
        }
        return false;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant,
      onPanResponderMove,
      onPanResponderRelease,
      onPanResponderTerminate: () => {},
    })
  ).current;

  if (!route) return null;

  const startJourney = () => {
    analytics.startJourney(route.id);
    setActiveJourneyRoute(route);
    onClose();
    router.push('/journey');
  };

  const toggleStops = (idx: number) => {
    analytics.trackClick();
    setStopsExpanded((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const legs = route.legs || [];

  // 1. Map each leg's departure/arrival onto map coordinates.
  const processedLegs = legs.map((leg) => ({
    ...leg,
    dep_lat: leg.departure_lat,
    dep_lon: leg.departure_lon,
    arr_lat: leg.arrival_lat,
    arr_lon: leg.arrival_lon,
  }));

  // 2. Build the station nodes shown on the map. Where one leg ends and the
  // next begins at the same place (you alight a bus and start walking from that
  // very stop), that's ONE physical point — draw a single circle, not two. Nodes
  // are added in journey order and merged into the previous one when they share
  // a name or sit within ~30m, so an alight+board point becomes one interchange.
  type MapNode = {
    lat: number;
    lon: number;
    label: string;
    isStart: boolean;
    isEnd: boolean;
    isTransfer: boolean;
  };
  const pointsList: MapNode[] = [];

  const addNode = (
    lat: number | null | undefined,
    lon: number | null | undefined,
    label: string,
    flags: { isStart?: boolean; isEnd?: boolean; isTransfer?: boolean }
  ) => {
    if (lat == null || lon == null) return;
    const last = pointsList[pointsList.length - 1];
    if (last) {
      const sameName = !!label && last.label.toLowerCase() === label.toLowerCase();
      const nearby =
        Math.abs(last.lat - lat) < 0.0003 && Math.abs(last.lon - lon) < 0.0003;
      if (sameName || nearby) {
        last.isStart = last.isStart || !!flags.isStart;
        last.isEnd = last.isEnd || !!flags.isEnd;
        last.isTransfer = last.isTransfer || !!flags.isTransfer;
        return;
      }
    }
    pointsList.push({
      lat,
      lon,
      label,
      isStart: !!flags.isStart,
      isEnd: !!flags.isEnd,
      isTransfer: !!flags.isTransfer,
    });
  };

  processedLegs.forEach((leg, lIdx) => {
    const isFirst = lIdx === 0;
    const isLast = lIdx === processedLegs.length - 1;
    // A mid-journey departure/arrival is an interchange (you change vehicles).
    addNode(leg.dep_lat, leg.dep_lon, leg.departure, { isStart: isFirst, isTransfer: !isFirst });
    addNode(leg.arr_lat, leg.arr_lon, leg.arrival, { isEnd: isLast, isTransfer: !isLast });
  });
  const latitudes = pointsList.map((p) => p.lat);
  const longitudes = pointsList.map((p) => p.lon);

  const hasMapCoords = pointsList.length > 0;
  const centerLat = latitudes.length > 0 ? latitudes.reduce((a, b) => a + b, 0) / latitudes.length : 51.5074;
  const centerLon = longitudes.length > 0 ? longitudes.reduce((a, b) => a + b, 0) / longitudes.length : -0.1278;

  // 3. Compile Leaflet script dynamically with gorgeous Wero styles
  let leafletJS = '';
  if (route.legs) {
    // A. Draw transit and walking paths
    processedLegs.forEach((leg) => {
      if (leg.dep_lat != null && leg.dep_lon != null && leg.arr_lat != null && leg.arr_lon != null) {
        const { bgColor } = getLegUIProps(leg.mode, leg.line, leg.instruction, accents);
        const isWalking = leg.mode.toLowerCase() === 'walking';

        let polylinePointsStr = '';
        // Need at least 2 points for a real path. A leg whose geometry was pruned
        // to a single point (the backend's monotonic-progress filter can do this on
        // short legs) must fall back to the straight dep→arr line below — otherwise
        // snapping both endpoints onto index 0 collapses it to a zero-length,
        // invisible polyline (this was the missing Mildmay line before "Go").
        if (leg.path_coords && leg.path_coords.length >= 2) {
          const pathPoints = [...leg.path_coords];
          // Some providers return a leg's geometry in the opposite order to the
          // leg's own dep→arr direction. Snapping the endpoints (below) onto
          // reversed geometry makes the drawn line shoot across to the far end
          // and trace back — the "dots going round in circles" artifact. Flip
          // the path first when that orientation reduces the endpoint mismatch.
          if (
            pathPoints.length > 1 &&
            leg.dep_lat != null && leg.dep_lon != null &&
            leg.arr_lat != null && leg.arr_lon != null
          ) {
            const sq = (aLat: number, aLon: number, bLat: number, bLon: number) =>
              (aLat - bLat) ** 2 + (aLon - bLon) ** 2;
            const head = pathPoints[0];
            const tail = pathPoints[pathPoints.length - 1];
            const asIs =
              sq(head[0], head[1], leg.dep_lat, leg.dep_lon) +
              sq(tail[0], tail[1], leg.arr_lat, leg.arr_lon);
            const flipped =
              sq(head[0], head[1], leg.arr_lat, leg.arr_lon) +
              sq(tail[0], tail[1], leg.dep_lat, leg.dep_lon);
            if (flipped < asIs) {
              pathPoints.reverse();
            }
          }
          if (leg.dep_lat != null && leg.dep_lon != null && pathPoints.length > 0) {
            pathPoints[0] = [leg.dep_lat, leg.dep_lon];
          }
          if (leg.arr_lat != null && leg.arr_lon != null && pathPoints.length > 0) {
            pathPoints[pathPoints.length - 1] = [leg.arr_lat, leg.arr_lon];
          }
          polylinePointsStr = JSON.stringify(pathPoints);
        } else {
          polylinePointsStr = `[[${leg.dep_lat}, ${leg.dep_lon}], [${leg.arr_lat}, ${leg.arr_lon}]]`;
        }

        if (isWalking) {
          // Walking: ink-outlined dotted line in the leg's own colour, so it
          // matches the walk badge on the route card (cyan) instead of reusing
          // the End marker's pink — keeps the map legible without a legend.
          leafletJS += `
            L.polyline(${polylinePointsStr}, {
              color: '#1d1c1c',
              weight: 10,
              dashArray: '1, 15',
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);

            L.polyline(${polylinePointsStr}, {
              color: '${bgColor}',
              weight: 6,
              dashArray: '1, 15',
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);
          `;
        } else {
          // Transit represented as bold ink-outlined solid lines!
          leafletJS += `
            L.polyline(${polylinePointsStr}, {
              color: '#1d1c1c',
              weight: 9,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);

            L.polyline(${polylinePointsStr}, {
              color: '${bgColor}',
              weight: 5,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);
          `;
        }
      }
    });

    // B. Draw station nodes — one circle per physical point (see addNode).
    pointsList.forEach((p) => {
      let fillColor = '#ffffff';
      let radius = 6;
      if (p.isStart) {
        fillColor = '#83f582'; // Wero Green
        radius = 9;
      } else if (p.isEnd) {
        fillColor = '#ff158a'; // Wero Pink
        radius = 9;
      } else if (p.isTransfer) {
        fillColor = '#fdad70'; // Wero Orange
        radius = 7;
      } else {
        fillColor = '#7af7f7'; // Wero Cyan
        radius = 6;
      }

      leafletJS += `
        L.circleMarker([${p.lat}, ${p.lon}], {
          radius: ${radius},
          fillColor: '${fillColor}',
          color: '#1d1c1c',
          weight: 2.5,
          opacity: 1,
          fillOpacity: 1
        }).addTo(map).bindPopup("<b>${p.label.replace(/"/g, '\\"')}</b>");
      `;
    });

  }

  const leafletHtml = `
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
        .leaflet-popup-content-wrapper {
          background-color: #ffffff;
          color: #1d1c1c;
          border: 2px solid #1d1c1c;
          border-radius: 8px;
          box-shadow: 4px 4px 0px #1d1c1c;
        }
        .leaflet-popup-tip {
          background-color: #ffffff;
          border: 2px solid #1d1c1c;
        }
        .leaflet-tile {
          filter: none;
          /* Mitigate gaps/seams between map tiles under scaling/fractional pixels */
          outline: 1px solid transparent;
        }
        .leaflet-tile-container img {
          box-shadow: 0 0 1px rgba(0,0,0,0.05);
        }
        .warning-marker-icon { background: none; border: none; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${centerLat}, ${centerLon}], 13);
        
        // Use colorful OpenStreetMap standard tiles
        const tilesUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        
        L.tileLayer(tilesUrl, {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        ${leafletJS}

        const bounds = [
          ${pointsList.map(p => `[${p.lat}, ${p.lon}]`).join(',')}
        ];
        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [35, 35] });
        }

        // Warning markers (Waze-style sensory icons) — shared with the journey map.
        ${warningMarkerScript()}

        // Receive marker updates pushed from React.
        window.addEventListener('message', function(event) {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.type === 'updateWarnings') {
              window.updateWarnings(data.warnings);
            }
          } catch (e) {}
        });
      </script>
    </body>
    </html>
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
        {/* Header row — back + home top-left (mirrors the journey screen) */}
        <View style={[styles.headerRow, { borderBottomColor: palette.divider }]}>
          <View style={styles.navButtonsRow}>
            <TouchableOpacity
              onPress={() => {
                analytics.trackClick();
                onClose();
              }}
              style={[styles.circleButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
              accessibilityRole="button"
              accessibilityLabel="Back to routes list"
            >
              <Ionicons name="arrow-back" size={20} color={palette.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                analytics.trackClick();
                onClose();
                router.replace('/');
              }}
              style={[styles.circleButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
              accessibilityRole="button"
              accessibilityLabel="Home"
            >
              <Ionicons name="home-outline" size={20} color={palette.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.routeTitle, { color: palette.textPrimary }]} numberOfLines={1}>
              {route.name}
            </Text>
            {route.subName ? (
              <Text style={[styles.routeSub, { color: palette.textSecondary }]} numberOfLines={1}>
                {route.subName}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Content Area - Map fills the screen, sheet Panel sits absolutely at the bottom */}
        <View style={{ flex: 1, position: 'relative' }}>
          {/* Map container fixed to background */}
          <View style={StyleSheet.absoluteFill}>
            {!hasMapCoords ? (
              <View style={styles.emptyMap}>
                <Ionicons name="map-outline" size={48} color={palette.textMuted} />
                <Text style={{ color: palette.textMuted, marginTop: 8 }}>Map coordinates unavailable for this route.</Text>
              </View>
            ) : (
              <View style={{ flex: 1, position: 'relative' }}>
                {Platform.OS === 'web' ? (
                  <iframe
                    srcDoc={leafletHtml}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="Route Map"
                    onLoad={() => setMapReadyTick((t) => t + 1)}
                  />
                ) : (
                  <WebView
                    ref={webViewRef}
                    source={{ html: leafletHtml }}
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                    originWhitelist={['*']}
                    domStorageEnabled={true}
                    javaScriptEnabled={true}
                    onMessage={(event) => {
                      try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.type === 'warningClick' && data.id) {
                          openWarningById(data.id);
                        }
                      } catch {
                        // Ignore
                      }
                    }}
                    onLoadEnd={() => setMapReadyTick((t) => t + 1)}
                  />
                )}
              </View>
            )}

            {/* Hide / show all warning markers (mirrors the journey screen) */}
            {hasMapCoords && (
              <TouchableOpacity
                onPress={() => {
                  analytics.trackClick();
                  setHideAll(!hideAll);
                }}
                style={[
                  styles.hideWarningsBtn,
                  { backgroundColor: hideAll ? accents.yellow : palette.surface, borderColor: palette.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel={hideAll ? 'Show sensory warnings on map' : 'Hide sensory warnings from map'}
              >
                <Ionicons name={hideAll ? 'eye-off' : 'eye'} size={20} color={palette.textPrimary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Timeline sheet panel overlapping the bottom of the map */}
          <Animated.View
            style={[
            styles.sheetPanel,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              height: SHEET_HEIGHT,
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              transform: [{ translateY: panY }]
            }
          ]}>
            {/* Drag handle header wrapper */}
            <View
              style={styles.sheetHeaderTouch}
              {...headerPanResponder.panHandlers}
            >
              {/* Sheet drag indicator bar */}
              <View style={styles.sheetHandleContainer}>
                <View style={[styles.sheetHandle, { backgroundColor: palette.divider }]} />
              </View>

              {/* Quick stats panel: duration + cost grouped left, Go button right */}
              <View style={styles.quickStatsRow}>
                <View style={styles.statsGroup}>
                  <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: palette.textMuted }]}>Duration</Text>
                    <Text style={[styles.statVal, { color: palette.textPrimary }]}>{route.duration} min</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: palette.textMuted }]}>Cost</Text>
                    <Text style={[styles.statVal, { color: palette.textPrimary }]}>£{route.price.toFixed(2)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={startJourney}
                  style={[styles.startJourneyButton, { backgroundColor: accents.green, borderColor: palette.border }]}
                  accessibilityRole="button"
                  accessibilityLabel="Start journey mode"
                >
                  <Ionicons name="play" size={18} color={palette.textPrimary} />
                  <Text style={[styles.startJourneyText, { color: palette.textPrimary }]}>Go</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flex: 1 }} {...sheetPanResponder.panHandlers}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e) => {
                  scrollOffsetY.current = e.nativeEvent.contentOffset.y;
                }}>
                {/* Sensory meters dashboard */}
                <View style={[styles.modalSensoryContainer, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                  <Text style={[styles.sensoryHeading, { color: palette.textPrimary }]}>Sensory alignment</Text>
                  <View style={styles.sensoryDashboard}>
                    <SensoryMeter level={route.noise} label="Sound" />
                    <SensoryMeter level={route.crowds} label="Crowds" />
                    <SensoryMeter level={route.heat} label="Heat" />
                    <SensoryMeter level={route.light} label="Light" />
                    <SensoryMeter level={route.smell} label="Smell" />
                  </View>
                  {route.sensory_description ? (
                    <Text style={[styles.sensoryDescText, { color: palette.textSecondary, borderTopColor: palette.divider }]}>
                      {route.sensory_description}
                    </Text>
                  ) : null}
                </View>

                {/* Step timeline list */}
                <View style={styles.timelineList}>
                  {route.legs && route.legs.map((leg, lIdx) => {
                    const { iconName, bgColor: lineBgColor, textColor: lineTextColor } = getLegUIProps(
                      leg.mode,
                      leg.line,
                      leg.instruction,
                      accents
                    );

                    return (
                      <View key={lIdx} style={styles.detailStepContainer}>
                        <View style={styles.stepIndicatorCol}>
                          <View style={[styles.stepNode, { backgroundColor: lineBgColor, borderColor: palette.border }]}>
                            <Ionicons name={iconName} size={11} color={lineTextColor} />
                          </View>
                          <View style={[styles.stepLine, { backgroundColor: lineBgColor }]} />
                        </View>
                        <View style={styles.stepContentCol}>
                          <Text style={[styles.stationText, { color: palette.textPrimary }]}>
                            {leg.departure}
                          </Text>
                          <Text style={[styles.instructionText, { color: palette.textSecondary }]}>
                            {leg.instruction} ({leg.duration_mins} mins)
                          </Text>

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Ionicons
                              name={leg.mode.toLowerCase() === 'walking' || leg.mode.toLowerCase() === 'walk' ? 'walk-outline' : 'exit-outline'}
                              size={13}
                              color={palette.textSecondary}
                              style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.arrivalText, { color: palette.textSecondary }]}>
                              {leg.mode.toLowerCase() === 'walking' || leg.mode.toLowerCase() === 'walk'
                                ? 'Walk to '
                                : 'Get off at '}
                              <Text style={{ fontWeight: '800', color: palette.textPrimary }}>
                                {leg.arrival}
                              </Text>
                            </Text>
                          </View>

                          {/* Collapsible intermediate stops list */}
                          {leg.stops && leg.stops.length > 0 && (
                            <View style={[styles.stopsDropdown, { borderLeftColor: linkColor }]}>
                              <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => toggleStops(lIdx)}
                                style={styles.stopsDropdownHeader}
                              >
                                <Text style={[styles.stopsHeader, { color: linkColor }]}>
                                  {stopsExpanded[lIdx] ? 'Hide' : 'Show'} {leg.stops.length} intermediate stop{leg.stops.length > 1 ? 's' : ''}
                                </Text>
                                <Ionicons
                                  name={stopsExpanded[lIdx] ? 'chevron-up' : 'chevron-down'}
                                  size={10}
                                  color={linkColor}
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

                          {/* Platform transfer / connection wait times */}
                          {leg.connection_waiting_mins && leg.connection_waiting_mins > 0 ? (
                            <View style={[styles.waitWarningCard, { backgroundColor: semantic.warningSurface, borderColor: semantic.warningBorder }]}>
                              <Ionicons name="warning" size={13} color={semantic.warningIcon} />
                              <Text style={[styles.waitWarningText, { color: semantic.warningText }]}>
                                {leg.connection_waiting_mins} min platform wait / transfer.
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}

                  {/* Terminal Destination Node */}
                  {route.legs && route.legs.length > 0 && (
                    <View style={styles.detailStepContainer}>
                      <View style={styles.stepIndicatorCol}>
                        <View style={[styles.stepNode, { backgroundColor: palette.textPrimary, borderColor: palette.border }]}>
                          <Ionicons name="pin" size={11} color={palette.surface} />
                        </View>
                      </View>
                      <View style={styles.stepContentCol}>
                        <Text style={[styles.stationText, { color: palette.textPrimary }]}>
                          {route.legs[route.legs.length - 1].arrival}
                        </Text>
                        <Text style={[styles.instructionText, { color: palette.textSecondary }]}>
                          Arrive at destination
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </Animated.View>

          {/* Tapped-warning action card — Remove (own) or Close (someone else's) */}
          {selectedWarning && (
            <View style={styles.warningOverlayRoot} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.warningBackdrop}
                activeOpacity={1}
                onPress={() => setSelectedWarning(null)}
              />
              <View style={styles.warningCenterContainer} pointerEvents="box-none">
                <View style={[styles.warningCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <TouchableOpacity
                    onPress={() => setSelectedWarning(null)}
                    style={[styles.warningCancelBtn, { backgroundColor: accents.pink, borderColor: palette.border }]}
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
                    <Text style={styles.warningCardEmoji}>{warningVisual(selectedWarning.icon, accents).emoji}</Text>
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

                  <Text style={[styles.warningCardHint, { color: palette.textMuted }]}>
                    {selectedIsOwn ? 'Removes it from the map for everyone' : 'Hides it for you only'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(29, 28, 28, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1.5,
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
  routeTitle: {
    fontSize: 16,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  routeSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  mapContainer: {
    height: 270,
    width: '100%',
    borderBottomWidth: 3,
    overflow: 'hidden',
  },
  emptyMap: {
    height: 270,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetPanel: {
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
  quickStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1.5,
  },
  statsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  statBox: {
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statVal: {
    fontSize: 15,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    marginTop: 2,
  },
  startJourneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 2.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    ...hardShadow(4),
  },
  startJourneyText: {
    fontSize: 15,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  modalSensoryContainer: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    ...hardShadow(4),
  },
  sensoryHeading: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  sensoryDashboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sensoryDescText: {
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 6,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  timelineList: {
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
  stationText: {
    fontSize: 13,
    fontWeight: '800',
  },
  instructionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  arrivalText: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  stopsDropdown: {
    marginTop: 4,
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
    fontSize: 10.5,
    fontWeight: '800',
  },
  stopsList: {
    gap: 2,
    marginTop: 2,
  },
  stopItemText: {
    fontSize: 11,
    fontWeight: '600',
  },
  waitWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    marginTop: 8,
  },
  waitWarningText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  mapTapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '75%',
    zIndex: 5,
  },
  hideWarningsBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...hardShadow(3),
  },
  warningOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  warningBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  warningCenterContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  warningCancelBtn: {
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
  warningCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCardEmoji: {
    fontSize: 22,
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
});
