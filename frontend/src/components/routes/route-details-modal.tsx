import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { getLegUIProps } from '@/components/routes/route-card';
import { SensoryMeter } from '@/components/routes/sensory-meter';
import { Fonts, getAccents, getPalette, getSemanticColors, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { RouteOption } from '@/types/route';

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

  const [stopsExpanded, setStopsExpanded] = useState<Record<number, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(false);

  // Bottom Sheet animations and dimensions
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;
  const COLLAPSED_HEIGHT = 105;
  const MAX_TRANSLATE_Y = SHEET_HEIGHT - COLLAPSED_HEIGHT;

  const panY = React.useRef(new Animated.Value(MAX_TRANSLATE_Y)).current;
  const lastTranslateY = React.useRef(MAX_TRANSLATE_Y);
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
      setIsExpanded(false);
      lastTranslateY.current = MAX_TRANSLATE_Y;
    }
  }, [visible, route, panY, MAX_TRANSLATE_Y]);

  const toggleExpanded = () => {
    const shouldExpand = !isExpanded;
    const toValue = shouldExpand ? 0 : MAX_TRANSLATE_Y;
    Animated.spring(panY, {
      toValue,
      useNativeDriver: Platform.OS !== 'web',
      tension: 50,
      friction: 8,
    }).start(() => {
      setIsExpanded(shouldExpand);
    });
  };

  const collapseSheet = () => {
    Animated.spring(panY, {
      toValue: MAX_TRANSLATE_Y,
      useNativeDriver: Platform.OS !== 'web',
      tension: 50,
      friction: 8,
    }).start(() => {
      setIsExpanded(false);
    });
  };

  // A drag is "the sheet's" when it's a clear vertical move AND either we're
  // pulling the sheet down while the list is already scrolled to the top, or
  // pulling it up while it isn't fully expanded. Everything else stays with the
  // inner ScrollView so normal content scrolling still works.
  const shouldClaimDrag = (dy: number, dx: number) => {
    const verticalEnough = Math.abs(dy) > 4 && Math.abs(dy) > Math.abs(dx);
    if (!verticalEnough) return false;
    if (dy > 0) return scrollOffsetY.current <= 0; // dragging down at the top → collapse
    return lastTranslateY.current > 1; // dragging up while not fully expanded → expand
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        shouldClaimDrag(gestureState.dy, gestureState.dx),
      // Capture phase: intercept the gesture before the inner ScrollView when it
      // is genuinely the sheet being dragged (fixes the intermittent swipe-down).
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        shouldClaimDrag(gestureState.dy, gestureState.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        panY.setOffset(lastTranslateY.current);
        panY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = gestureState.dy;
        const minVal = -lastTranslateY.current;
        const maxVal = MAX_TRANSLATE_Y - lastTranslateY.current;
        panY.setValue(Math.max(minVal, Math.min(maxVal, newY)));
      },
      onPanResponderRelease: (_, gestureState) => {
        panY.flattenOffset();
        const currentY = lastTranslateY.current;
        const velocityY = gestureState.vy;
        
        let targetY = MAX_TRANSLATE_Y;
        let shouldExpand = false;
        
        if (velocityY < -0.3) {
          targetY = 0;
          shouldExpand = true;
        } else if (velocityY > 0.3) {
          targetY = MAX_TRANSLATE_Y;
          shouldExpand = false;
        } else {
          const halfway = MAX_TRANSLATE_Y / 2;
          if (currentY < halfway) {
            targetY = 0;
            shouldExpand = true;
          } else {
            targetY = MAX_TRANSLATE_Y;
            shouldExpand = false;
          }
        }
        
        Animated.spring(panY, {
          toValue: targetY,
          useNativeDriver: Platform.OS !== 'web',
          tension: 50,
          friction: 8,
        }).start(() => {
          setIsExpanded(shouldExpand);
        });
      },
    })
  ).current;

  if (!route) return null;

  const toggleStops = (idx: number) => {
    setStopsExpanded((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const legs = route.legs || [];

  // 1. Process legs and identify in-station transfer walks
  const processedLegs = legs.map((leg) => ({
    ...leg,
    dep_lat: leg.departure_lat,
    dep_lon: leg.departure_lon,
    arr_lat: leg.arrival_lat,
    arr_lon: leg.arrival_lon,
  }));

  const transferLegs: {
    dep_lat: number;
    dep_lon: number;
    arr_lat: number;
    arr_lon: number;
    label: string;
    duration: number;
  }[] = [];

  const transferStations: Set<number> = new Set();

  if (route.legs) {
    for (let i = 0; i < processedLegs.length - 1; i++) {
      const legPrev = processedLegs[i];
      const legNext = processedLegs[i + 1];

      if (
        legPrev.arr_lat != null &&
        legPrev.arr_lon != null &&
        legNext.dep_lat != null &&
        legNext.dep_lon != null
      ) {
        const isSameStation =
          legPrev.arrival.toLowerCase() === legNext.departure.toLowerCase() ||
          (Math.abs(legPrev.arr_lat - legNext.dep_lat) < 0.0001 &&
           Math.abs(legPrev.arr_lon - legNext.dep_lon) < 0.0001);

        if (isSameStation) {
          const waitTime = legPrev.connection_waiting_mins || 3;
          
          // Shift them slightly diagonally (approx. 50-70m offset) to separate arrival/departure platforms
          const offsetLat = 0.0002;
          const offsetLon = 0.0002;

          legPrev.arr_lat = legPrev.arr_lat - offsetLat;
          legPrev.arr_lon = legPrev.arr_lon - offsetLon;

          legNext.dep_lat = legNext.dep_lat + offsetLat;
          legNext.dep_lon = legNext.dep_lon + offsetLon;

          transferLegs.push({
            dep_lat: legPrev.arr_lat,
            dep_lon: legPrev.arr_lon,
            arr_lat: legNext.dep_lat,
            arr_lon: legNext.dep_lon,
            label: `${legPrev.arrival} (Transfer: ${waitTime} min walk)`,
            duration: waitTime,
          });

          transferStations.add(i);
        }
      }
    }
  }

  // 2. Gather unique platform nodes for styling on the map
  const uniqueNodes: Record<string, { lat: number; lon: number; label: string; isStart: boolean; isEnd: boolean; isTransfer: boolean }> = {};

  if (route.legs) {
    processedLegs.forEach((leg, lIdx) => {
      const isStart = lIdx === 0;
      const isEnd = lIdx === processedLegs.length - 1;

      if (leg.dep_lat != null && leg.dep_lon != null) {
        const key = `${leg.departure.toLowerCase()}_dep_${lIdx}`;
        uniqueNodes[key] = {
          lat: leg.dep_lat,
          lon: leg.dep_lon,
          label: leg.departure + (isStart ? '' : ' Platform'),
          isStart,
          isEnd: false,
          isTransfer: lIdx > 0 && transferStations.has(lIdx - 1),
        };
      }
      if (leg.arr_lat != null && leg.arr_lon != null) {
        const key = `${leg.arrival.toLowerCase()}_arr_${lIdx}`;
        uniqueNodes[key] = {
          lat: leg.arr_lat,
          lon: leg.arr_lon,
          label: leg.arrival + (isEnd ? '' : ' Platform'),
          isStart: false,
          isEnd,
          isTransfer: transferStations.has(lIdx),
        };
      }
    });
  }

  const pointsList = Object.values(uniqueNodes);
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
        if (leg.path_coords && leg.path_coords.length > 0) {
          const pathPoints = [...leg.path_coords];
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
          // Walking represented as outlined pink dots!
          leafletJS += `
            L.polyline(${polylinePointsStr}, {
              color: '#1d1c1c',
              weight: 10,
              dashArray: '1, 15',
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);

            L.polyline(${polylinePointsStr}, {
              color: '#ff158a', // Wero Pink
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

    // B. Draw in-station transfer walks (orange dots with black outline)
    transferLegs.forEach((trans) => {
      leafletJS += `
        L.polyline([
          [${trans.dep_lat}, ${trans.dep_lon}],
          [${trans.arr_lat}, ${trans.arr_lon}]
        ], {
          color: '#1d1c1c',
          weight: 9,
          dashArray: '1, 12',
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        L.polyline([
          [${trans.dep_lat}, ${trans.dep_lon}],
          [${trans.arr_lat}, ${trans.arr_lon}]
        ], {
          color: '#fdad70', // Wero Orange
          weight: 5,
          dashArray: '1, 12',
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map).bindPopup("<b>${trans.label.replace(/"/g, '\\"')}</b>");
      `;
    });

    // C. Draw station and platform nodes
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
        {/* Header row */}
        <View style={[styles.headerRow, { borderBottomColor: palette.divider }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.routeTitle, { color: palette.textPrimary }]}>
              {route.name}
            </Text>
            {route.subName ? (
              <Text style={[styles.routeSub, { color: palette.textSecondary }]}>
                {route.subName}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: semantic.neutralSurface, borderColor: palette.border }]}
            accessibilityLabel="Close detailed route overlay"
          >
            <Ionicons name="close" size={20} color={palette.textPrimary} />
          </TouchableOpacity>
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
                  />
                ) : (
                  <WebView
                    source={{ html: leafletHtml }}
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                    originWhitelist={['*']}
                    domStorageEnabled={true}
                    javaScriptEnabled={true}
                  />
                )}

                {/* Floating Map Legend - Clean and compact */}
                <View style={[styles.floatingLegend, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendIndicator, { backgroundColor: '#83f582', borderColor: palette.border, borderRadius: 5, width: 8, height: 8 }]} />
                    <Text style={[styles.legendTextMin, { color: palette.textSecondary }]}>Start</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendIndicator, { backgroundColor: '#ff158a', borderColor: palette.border, borderRadius: 5, width: 8, height: 8 }]} />
                    <Text style={[styles.legendTextMin, { color: palette.textSecondary }]}>End</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendIndicator, { backgroundColor: '#fdad70', borderColor: palette.border, borderRadius: 5, width: 8, height: 8 }]} />
                    <Text style={[styles.legendTextMin, { color: palette.textSecondary }]}>Transfer</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Transparent click-to-collapse overlay above the sheet when expanded */}
          {isExpanded && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={collapseSheet}
              style={styles.mapTapOverlay}
            />
          )}

          {/* Timeline sheet panel overlapping the bottom of the map */}
          <Animated.View
            {...panResponder.panHandlers}
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
            {/* Tappable header wrapper (drag is handled by the sheet itself) */}
            <View
              style={styles.sheetHeaderTouch}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={toggleExpanded}
                style={{ width: '100%' }}
              >
                {/* Sheet drag indicator bar */}
                <View style={styles.sheetHandleContainer}>
                  <View style={[styles.sheetHandle, { backgroundColor: palette.divider }]} />
                </View>

                {/* Quick stats panel */}
                <View style={styles.quickStatsRow}>
                  <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: palette.textMuted }]}>Duration</Text>
                    <Text style={[styles.statVal, { color: palette.textPrimary }]}>{route.duration} min</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: palette.textMuted }]}>Cost</Text>
                    <Text style={[styles.statVal, { color: palette.textPrimary }]}>£{route.price.toFixed(2)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

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
          </Animated.View>
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
    padding: 16,
    borderBottomWidth: 1.5,
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
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
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
  floatingLegend: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderWidth: 2,
    borderRadius: 8,
    padding: 6,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
    ...hardShadow(2),
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendIndicator: {
    borderWidth: 1,
  },
  legendTextMin: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
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
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderBottomWidth: 1.5,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statVal: {
    fontSize: 14,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    marginTop: 2,
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
});
