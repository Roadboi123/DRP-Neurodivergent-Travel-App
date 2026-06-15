import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { getLegUIProps } from '@/components/routes/route-card';
import { WarningConfidence } from '@/components/routes/warning-confidence';
import { WALK_BLUE, modeEmoji, warningDisplayDesc, warningMarkerScript, warningVisual } from '@/components/routes/warning-markers';
import { BlurView } from 'expo-blur';

import { CLEARWAY, Fonts, GLASS, getAccents, getPalette, getSemanticColors, Radii, softShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';
import { useRouteWarnings } from '@/hooks/use-route-warnings';
import { setActiveJourneyLabels, setActiveJourneyRoute } from '@/services/active-journey';
import type { RouteOption } from '@/types/route';
import { analytics } from '@/services/analytics';
import { buildChangeInstruction, cleanInstruction, cleanPlaceLabel } from '@/utils/place-label';

interface RouteDetailsModalProps {
  visible: boolean;
  route: RouteOption | null;
  /** Human labels the traveller typed, used as friendly fallbacks when a leg
   *  endpoint is only a raw coordinate. */
  originLabel?: string;
  destinationLabel?: string;
  onClose: () => void;
}

interface WebSafeModalProps {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}

function WebSafeModal({ visible, onRequestClose, children }: WebSafeModalProps) {
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onRequestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onRequestClose]);

  if (Platform.OS === 'web') {
    if (!visible) return null;
    return (
      <View
        style={{
          position: 'fixed' as any,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          zIndex: 99999,
        }}
      >
        {children}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onRequestClose}
    >
      {children}
    </Modal>
  );
}

export function RouteDetailsModal({ visible, route: propRoute, originLabel, destinationLabel, onClose }: RouteDetailsModalProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const { username } = useAuth();
  const semantic = getSemanticColors(isDark);
  const linkColor = semantic.link;

  // Cache the route prop so that when selectedRoute becomes null on the parent,
  // the Modal remains mounted and can perform its closing transition/cleanup
  // with visible=false.
  const [cachedRoute, setCachedRoute] = useState<RouteOption | null>(null);

  React.useEffect(() => {
    if (propRoute) {
      setCachedRoute(propRoute);
    }
  }, [propRoute]);

  const route = propRoute || cachedRoute;

  // Friendly fallbacks for when a leg endpoint is only a coordinate: prefer the
  // labels the traveller actually typed, then a generic phrase.
  const originFallback = cleanPlaceLabel(originLabel, 'Your location');
  const destinationFallback = cleanPlaceLabel(destinationLabel, 'your destination');

  // Web Scroll Restoration / Layout Fix:
  // React Native Web's Modal component locks body scrolling by applying styles to
  // document.body/document.documentElement. If the modal is unmounted or hidden
  // during screen transitions/navigation, these styles can get stuck, causing a
  // white/frozen screen. We add robust force-restoration hooks to avoid this.
  React.useEffect(() => {
    return () => {
      if (Platform.OS === 'web') {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        if (document.documentElement) {
          document.documentElement.style.overflow = '';
        }
      }
    };
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!visible) {
      const restoreScroll = () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        if (document.documentElement) {
          document.documentElement.style.overflow = '';
        }
      };
      restoreScroll();
      const timer = setTimeout(restoreScroll, 150);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // User-reported warnings on the pre-Go map — same source, markers and
  // remove/hide actions as the live journey. Poll only while the sheet is open.
  const {
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
  const [isExpanded, setIsExpanded] = React.useState(false);

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
        } else if (data.type === 'warningClusterClick' && data.ids) {
          openClusterByIds(data.ids);
        }
      } catch {
        // Ignore other/external window messages
      }
    };
    window.addEventListener('message', handleWebMessage);
    return () => window.removeEventListener('message', handleWebMessage);
  }, [openWarningById, openClusterByIds]);

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
      setIsExpanded(false);
    }
  }, [visible, route, panY, MAX_TRANSLATE_Y]);

  // On web the sheet sits over a full-screen map <iframe>. While dragging the
  // sheet the pointer can pass over the iframe, which swallows the gesture and
  // makes the drag stutter/"snap". Disabling the iframe's pointer events for the
  // duration of the drag keeps the JS-driven gesture smooth (mirrors the live
  // journey screen, where the same trick keeps the swipe fluid).
  const setMapInteractive = (interactive: boolean) => {
    if (Platform.OS !== 'web') return;
    const f = document.querySelector('iframe');
    if (f) (f as HTMLElement).style.pointerEvents = interactive ? 'auto' : 'none';
  };

  const onPanResponderGrant = () => {
    startTranslateY.current = lastTranslateY.current;
    panY.setOffset(startTranslateY.current);
    panY.setValue(0);
    setMapInteractive(false);
  };

  const onPanResponderMove = (_: any, gestureState: any) => {
    const newY = gestureState.dy;
    const minVal = -startTranslateY.current;
    const maxVal = MAX_TRANSLATE_Y - startTranslateY.current;
    panY.setValue(Math.max(minVal, Math.min(maxVal, newY)));
  };

  const onPanResponderRelease = (_: any, gestureState: any) => {
    setMapInteractive(true);
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

  const headerPanResponder = React.useRef(
    PanResponder.create({
      // Grab the gesture instantly when the bare handle is touched, so dragging
      // the sheet stays responsive...
      onStartShouldSetPanResponder: () => true,
      // ...but DON'T capture on touch-down: capture=false lets a child control
      // (the Go button) win a plain tap, so its onPress still fires on a device.
      onStartShouldSetPanResponderCapture: () => false,
      // A drag that begins on the button is stolen back here on move, so you can
      // still swipe the sheet from anywhere on the header.
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant,
      onPanResponderMove,
      onPanResponderRelease,
      onPanResponderTerminate: () => setMapInteractive(true),
    })
  ).current;

  const sheetPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dy, dx } = gestureState;
        const verticalEnough = Math.abs(dy) > 2 && Math.abs(dy) > Math.abs(dx);
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
        const verticalEnough = Math.abs(dy) > 2 && Math.abs(dy) > Math.abs(dx);
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
      onPanResponderTerminate: () => setMapInteractive(true),
    })
  ).current;

  const startJourney = () => {
    if (!route) return;
    analytics.startJourney(route.id);
    setActiveJourneyRoute(route);
    setActiveJourneyLabels(originLabel ?? '', destinationLabel ?? '');

    requestAnimationFrame(() => {
      router.push('/journey');
      setTimeout(() => {
        onClose();
      }, 150);
    });
  };

  const toggleStops = (idx: number) => {
    analytics.trackClick();
    setStopsExpanded((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const { leafletHtml, hasMapCoords } = React.useMemo(() => {
    if (!route) {
      return { leafletHtml: '', hasMapCoords: false };
    }
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
      boardMode: string;
    };
    const pointsList: MapNode[] = [];

    const addNode = (
      lat: number | null | undefined,
      lon: number | null | undefined,
      label: string,
      flags: { isStart?: boolean; isEnd?: boolean; isTransfer?: boolean; boardMode?: string }
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
          if (flags.boardMode) last.boardMode = flags.boardMode;
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
        boardMode: flags.boardMode || '',
      });
    };

    processedLegs.forEach((leg, lIdx) => {
      const isFirst = lIdx === 0;
      const isLast = lIdx === processedLegs.length - 1;
      addNode(leg.dep_lat, leg.dep_lon, leg.departure, { isStart: isFirst, isTransfer: !isFirst, boardMode: leg.mode });
      addNode(leg.arr_lat, leg.arr_lon, leg.arrival, { isEnd: isLast, isTransfer: !isLast });
    });
    const latitudes = pointsList.map((p) => p.lat);
    const longitudes = pointsList.map((p) => p.lon);

    const boundsPoints: [number, number][] = [];
    pointsList.forEach((p) => boundsPoints.push([p.lat, p.lon]));
    processedLegs.forEach((leg) => {
      if (leg.path_coords) {
        leg.path_coords.forEach((pt) => {
          if (pt && pt.length === 2) {
            boundsPoints.push([pt[0], pt[1]]);
          }
        });
      }
    });

    const hasMapCoords = boundsPoints.length > 0;
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
          if (leg.path_coords && leg.path_coords.length >= 2) {
            const pathPoints = [...leg.path_coords];
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
            leafletJS += `
              L.polyline(${polylinePointsStr}, {
                color: '#1d1c1c',
                weight: 10,
                dashArray: '1, 15',
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);

              L.polyline(${polylinePointsStr}, {
                color: '${WALK_BLUE}',
                weight: 6,
                dashArray: '1, 15',
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);
            `;
          } else {
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

      // Build a readable interchange instruction for each change, keyed by the
      // change station, so a tapped change marker explains the transfer.
      const changePopupByKey: Record<string, string> = {};
      for (let i = 0; i < processedLegs.length - 1; i++) {
        const fromLeg = processedLegs[i];
        const toLeg = processedLegs[i + 1];
        changePopupByKey[(toLeg.departure || fromLeg.arrival || '').toLowerCase()] =
          buildChangeInstruction(fromLeg, toLeg);
      }

      // B. Draw nodes: start (green) and end (red) are plain dots; every
      // interchange is a white "change here" marker with the boarding mode's
      // emoji, matching the live journey map.
      pointsList.forEach((p) => {
        if (p.isStart || p.isEnd) {
          const fillColor = p.isStart ? '#5b9d6b' : '#e23b3b';
          leafletJS += `
            L.circleMarker([${p.lat}, ${p.lon}], {
              radius: 9,
              fillColor: '${fillColor}',
              color: '#1d1c1c',
              weight: 2.5,
              opacity: 1,
              fillOpacity: 1
            }).addTo(map).bindPopup("<b>${cleanPlaceLabel(p.label, 'Stop').replace(/"/g, '\\"')}</b>");
          `;
        } else {
          const emoji = modeEmoji(p.boardMode);
          const popupText = (changePopupByKey[(p.label || '').toLowerCase()] || cleanPlaceLabel(p.label, 'Change here')).replace(/"/g, '&quot;');
          leafletJS += `
            L.marker([${p.lat}, ${p.lon}], {
              icon: L.divIcon({
                html: '<div style="background:#ffffff;width:30px;height:30px;border-radius:50%;border:3px solid #1d1c1c;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 5px rgba(0,0,0,0.3);"><span style="font-size:15px;line-height:1;">${emoji}</span></div>',
                className: 'change-marker-icon',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
              })
            }).addTo(map).bindPopup("<b>${popupText}</b>");
          `;
        }
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
          .warning-marker-icon, .change-marker-icon { background: none; border: none; }
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

          setTimeout(() => {
            map.invalidateSize();
            const bounds = ${JSON.stringify(boundsPoints)};
            if (bounds.length > 0) {
              map.fitBounds(bounds, { paddingTopLeft: [60, 60], paddingBottomRight: [60, 160], maxZoom: 13 });
            }
          }, 200);

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

    return { leafletHtml, hasMapCoords };
  }, [route, accents]);

  if (!route) return null;

  return (
    <WebSafeModal
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalSheet, { backgroundColor: CLEARWAY.bgBase }]}>
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

          {/* Compact 2×2 map key, inline with the nav buttons (above the map's
              Hide-warnings button) — same content/position as the live journey. */}
          <View style={[styles.headerLegend, { backgroundColor: '#f6f8fb', borderColor: palette.border }]}>
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
                        } else if (data.type === 'warningClusterClick' && data.ids) {
                          openClusterByIds(data.ids);
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
                  { backgroundColor: hideAll ? CLEARWAY.blueStrong : '#f6f8fb', borderColor: hideAll ? CLEARWAY.blueStrong : palette.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel={hideAll ? 'Show sensory warnings on map' : 'Hide sensory warnings from map'}
              >
                <Ionicons name={hideAll ? 'eye-off' : 'eye'} size={16} color={hideAll ? CLEARWAY.white : palette.textPrimary} />
                <Text style={[styles.hideWarningsText, { color: hideAll ? CLEARWAY.white : palette.textPrimary }]}>
                  {hideAll ? 'Show warnings' : 'Hide warnings'}
                </Text>
              </TouchableOpacity>
            )}

          </View>

          {/* Timeline sheet panel overlapping the bottom of the map */}
          <Animated.View
            pointerEvents="box-none"
            style={[
            styles.sheetPanel,
            {
              backgroundColor: GLASS.light.fill,
              borderColor: GLASS.light.border,
              height: SHEET_HEIGHT,
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              transform: [{ translateY: panY }]
            }
          ]}>
            <BlurView intensity={GLASS.light.blur} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
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
                  style={[styles.startJourneyButton, { backgroundColor: CLEARWAY.blue }]}
                  accessibilityRole="button"
                  accessibilityLabel="Start journey mode"
                >
                  <Ionicons name="play" size={18} color={CLEARWAY.white} />
                  <Text style={[styles.startJourneyText, { color: CLEARWAY.white }]}>Start journey</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View pointerEvents={isExpanded ? 'auto' : 'none'} style={{ flex: 1 }} {...sheetPanResponder.panHandlers}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e) => {
                  scrollOffsetY.current = e.nativeEvent.contentOffset.y;
                }}>
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
                            {cleanPlaceLabel(leg.departure, lIdx === 0 ? originFallback : 'This stop')}
                          </Text>
                          <Text style={[styles.instructionText, { color: palette.textSecondary }]}>
                            {cleanInstruction(leg.instruction)} ({leg.duration_mins} mins)
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
                                {cleanPlaceLabel(leg.arrival, lIdx === (route.legs?.length ?? 0) - 1 ? destinationFallback : 'the next stop')}
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
                          {cleanPlaceLabel(route.legs[route.legs.length - 1].arrival, destinationFallback)}
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
                <View style={[styles.warningCard, { backgroundColor: '#eef1f5', borderColor: palette.border }]}>
                  <TouchableOpacity
                    onPress={() => setSelectedWarning(null)}
                    style={[styles.warningCancelBtn, { backgroundColor: '#eef1f5', borderColor: palette.border }]}
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
            <View style={styles.warningOverlayRoot} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.warningBackdrop}
                activeOpacity={1}
                onPress={() => setSelectedCluster(null)}
              />
              <View style={styles.warningCenterContainer} pointerEvents="box-none">
                <View style={[styles.warningCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <TouchableOpacity
                    onPress={() => setSelectedCluster(null)}
                    style={[styles.warningCancelBtn, { backgroundColor: accents.pink, borderColor: palette.border }]}
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
        </View>
      </SafeAreaView>
    </WebSafeModal>
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
    borderBottomWidth: 1,
  },
  navButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow(1),
  },
  routeTitle: {
    fontSize: 18,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  routeSub: {
    fontSize: 12,
    fontFamily: Fonts?.body,
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
    borderTopLeftRadius: Radii.cardLg,
    borderTopRightRadius: Radii.cardLg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
    ...softShadow(3),
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
    borderBottomWidth: 1,
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
    fontSize: 10,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  statVal: {
    fontSize: 16,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  startJourneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: Radii.pill,
    paddingVertical: 13,
    paddingHorizontal: 24,
    ...softShadow(1),
  },
  startJourneyText: {
    fontSize: 15,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
  stationText: {
    fontSize: 13.5,
    fontFamily: Fonts?.semibold,
    fontWeight: '800',
  },
  instructionText: {
    fontSize: 12.5,
    fontFamily: Fonts?.body,
    fontWeight: '500',
  },
  arrivalText: {
    fontSize: 12,
    fontFamily: Fonts?.body,
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
    fontWeight: '600',
  },
  waitWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radii.input,
    borderWidth: 1,
    marginTop: 8,
  },
  waitWarningText: {
    fontSize: 11.5,
    fontFamily: Fonts?.body,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: Radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    zIndex: 10,
    ...softShadow(1),
  },
  hideWarningsText: {
    fontSize: 11,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0.1,
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
    borderWidth: 1,
    borderRadius: Radii.cardLg,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
    gap: 8,
    ...softShadow(3),
  },
  warningCancelBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow(1),
  },
  warningCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCardEmoji: {
    fontSize: 22,
  },
  warningCardTitle: {
    fontSize: 17,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginTop: 2,
  },
  warningCardDesc: {
    fontSize: 12.5,
    fontFamily: Fonts?.body,
    fontWeight: '500',
    lineHeight: 17,
    textAlign: 'center',
  },
  warningCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radii.pill,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignSelf: 'stretch',
    marginTop: 4,
    ...softShadow(1),
  },
  warningCardActionText: {
    fontSize: 13,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
  },
  warningCardHint: {
    fontSize: 11,
    fontFamily: Fonts?.body,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Compact 2×2 map key overlay (top-left of the pre-Go map).
  // Map key inline in the header row, pushed to the right (above the map's
  // Hide-warnings button), matching the live journey screen's position.
  headerLegend: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    ...softShadow(1),
  },
  legendCol: { gap: 5 },
  legendRowItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 13, height: 13, borderRadius: 7 },
  legendWalkDots: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 13, justifyContent: 'center' },
  legendWalkDot: { width: 4, height: 4, borderRadius: 2 },
  legendLabel: { fontSize: 11.5, fontFamily: Fonts?.semibold, fontWeight: '700' },
  legendEmojiStack: { flexDirection: 'row', alignItems: 'center' },
  legendEmojiChip: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1, backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
  },
  legendEmojiOverlap: { marginLeft: -8 },
  legendEmoji: { fontSize: 10 },
  clusterList: { alignSelf: 'stretch', maxHeight: 260, marginTop: 4 },
  clusterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  clusterRowIcon: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  clusterRowTitle: { fontSize: 13, fontFamily: Fonts?.semibold, fontWeight: '700' },
  clusterRowDesc: { fontSize: 12, fontFamily: Fonts?.body, lineHeight: 16 },
});
