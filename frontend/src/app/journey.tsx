import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { getLegUIProps } from '@/components/routes/route-card';
import { Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getActiveJourneyRoute } from '@/services/active-journey';
import type { RouteOption } from '@/types/route';

type SensoryReportType = 'sound' | 'heat' | 'smell' | 'crowds' | 'other';

const REPORT_OPTIONS: {
  type: SensoryReportType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { type: 'sound', label: 'Sound', icon: 'radio-outline', color: '#7af7f7' },
  { type: 'heat', label: 'Heat', icon: 'thermometer-outline', color: '#ff158a' },
  { type: 'smell', label: 'Smell', icon: 'flower-outline', color: '#83f582' },
  { type: 'crowds', label: 'Crowds', icon: 'people-outline', color: '#fdad70' },
  { type: 'other', label: 'Other', icon: 'add-circle-outline', color: '#fff48d' },
];

function buildJourneyMap(route: RouteOption, submittedReports: SensoryReportType[], accents: ReturnType<typeof getAccents>) {
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

  const legWithPath = processedLegs.find((leg) => leg.path_coords && leg.path_coords.length > 2);
  const legWithCoords = processedLegs.find(
    (leg) => leg.dep_lat != null && leg.dep_lon != null && leg.arr_lat != null && leg.arr_lon != null
  );
  const reportPoint =
    legWithPath?.path_coords && legWithPath.path_coords.length > 2
      ? legWithPath.path_coords[Math.floor(legWithPath.path_coords.length / 2)]
      : legWithCoords
        ? [
            ((legWithCoords.dep_lat ?? 0) + (legWithCoords.arr_lat ?? 0)) / 2,
            ((legWithCoords.dep_lon ?? 0) + (legWithCoords.arr_lon ?? 0)) / 2,
          ]
        : null;

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

  if (reportPoint && submittedReports.length > 0) {
    submittedReports.forEach((reportType, index) => {
      const option = REPORT_OPTIONS.find((item) => item.type === reportType) ?? REPORT_OPTIONS[REPORT_OPTIONS.length - 1];
      const offset = index * 0.00012;
      leafletJS += `
        L.circleMarker([${reportPoint[0] + offset}, ${reportPoint[1] - offset}], {
          radius: 11,
          fillColor: '${option.color}',
          color: '#1d1c1c',
          weight: 3,
          opacity: 1,
          fillOpacity: 1
        }).addTo(map).bindPopup("<b>${option.label} report</b><br/>Thanks for helping other travellers.");
      `;
    });
  }

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
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${centerLat}, ${centerLon}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        ${leafletJS}
        const bounds = [${nodes.map((node) => `[${node.lat}, ${node.lon}]`).join(',')}];
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [35, 35] });
      </script>
    </body>
    </html>
  `;
}

export default function JourneyScreen() {
  const route = getActiveJourneyRoute();
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const [reportingType, setReportingType] = useState<SensoryReportType | null>(null);
  const [submittedReports, setSubmittedReports] = useState<SensoryReportType[]>([]);

  const activeReport = REPORT_OPTIONS.find((option) => option.type === reportingType);
  const mapHtml = useMemo(
    () => (route ? buildJourneyMap(route, submittedReports, accents) : ''),
    [route, submittedReports, accents]
  );

  if (!route) {
    return (
      <SafeAreaView style={[styles.screen, styles.emptyState, { backgroundColor: palette.background }]}>
        <Text style={[styles.emptyText, { color: palette.textPrimary }]}>No active journey.</Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/routes')}
          style={[styles.backButton, { backgroundColor: accents.green, borderColor: palette.border }]}
        >
          <Text style={[styles.backButtonText, { color: palette.textPrimary }]}>Routes</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const submitReport = () => {
    if (!reportingType) return;
    setSubmittedReports((prev) => [...prev, reportingType]);
    setReportingType(null);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.surface }]}>
      <View style={StyleSheet.absoluteFill}>
        {Platform.OS === 'web' ? (
          <iframe srcDoc={mapHtml} style={{ width: '100%', height: '100%', border: 'none' }} title="Journey Map" />
        ) : (
          <WebView
            source={{ html: mapHtml }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            originWhitelist={['*']}
            domStorageEnabled={true}
            javaScriptEnabled={true}
          />
        )}
      </View>

      <View style={styles.topControls}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.iconButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
          accessibilityRole="button"
          accessibilityLabel="Back to route details"
        >
          <Ionicons name="arrow-back" size={22} color={palette.textPrimary} />
        </TouchableOpacity>
        <View style={[styles.activeBadge, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Ionicons name="navigate" size={16} color={palette.textPrimary} />
          <Text style={[styles.activeBadgeText, { color: palette.textPrimary }]}>Journey active</Text>
        </View>
      </View>

      <View style={[styles.reportRail, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {REPORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.type}
            activeOpacity={0.85}
            onPress={() => setReportingType(option.type)}
            style={[
              styles.reportRailButton,
              {
                backgroundColor: reportingType === option.type ? option.color : palette.surface,
                borderColor: palette.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Report ${option.label.toLowerCase()}`}
          >
            <Ionicons name={option.icon} size={19} color={palette.textPrimary} />
            <Text style={[styles.reportRailLabel, { color: palette.textPrimary }]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.tripBar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View>
          <Text style={[styles.tripLabel, { color: palette.textMuted }]}>Duration</Text>
          <Text style={[styles.tripValue, { color: palette.textPrimary }]}>{route.duration} min</Text>
        </View>
        <View>
          <Text style={[styles.tripLabel, { color: palette.textMuted }]}>Reports</Text>
          <Text style={[styles.tripValue, { color: palette.textPrimary }]}>{submittedReports.length}</Text>
        </View>
        <View>
          <Text style={[styles.tripLabel, { color: palette.textMuted }]}>Cost</Text>
          <Text style={[styles.tripValue, { color: palette.textPrimary }]}>£{route.price.toFixed(2)}</Text>
        </View>
      </View>

      {reportingType && activeReport && (
        <View style={[styles.reportSheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <TouchableOpacity
            onPress={() => setReportingType(null)}
            style={styles.reportDismissButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel sensory report"
          >
            <Ionicons name="close-circle" size={20} color={palette.textPrimary} />
          </TouchableOpacity>
          <View style={[styles.reportIconLarge, { backgroundColor: activeReport.color, borderColor: palette.border }]}>
            <Ionicons name={activeReport.icon} size={30} color={palette.textPrimary} />
          </View>
          <View style={styles.reportCopy}>
            <Text style={[styles.reportTitle, { color: palette.textPrimary }]}>Report {activeReport.label}</Text>
            <Text style={[styles.reportBody, { color: palette.textSecondary }]}>
              Share this sensory warning for people taking this route after you.
            </Text>
          </View>
          <TouchableOpacity
            onPress={submitReport}
            activeOpacity={0.85}
            style={[styles.submitReportButton, { backgroundColor: accents.green, borderColor: palette.border }]}
            accessibilityRole="button"
            accessibilityLabel={`Submit ${activeReport.label.toLowerCase()} report`}
          >
            <Text style={[styles.submitReportText, { color: palette.textPrimary }]}>Submit</Text>
          </TouchableOpacity>
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
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow(4),
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    ...hardShadow(3),
  },
  activeBadgeText: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  reportRail: {
    position: 'absolute',
    top: 92,
    right: 14,
    zIndex: 10,
    borderWidth: 2,
    borderRadius: 14,
    padding: 6,
    gap: 6,
    ...hardShadow(3),
  },
  reportRailButton: {
    width: 64,
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 3,
  },
  reportRailLabel: {
    fontSize: 8.5,
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
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    ...hardShadow(5),
  },
  tripLabel: {
    fontSize: 9,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tripValue: {
    fontSize: 14,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    marginTop: 2,
  },
  reportSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    zIndex: 20,
    borderWidth: 3,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...hardShadow(6),
  },
  reportDismissButton: {
    position: 'absolute',
    top: -10,
    left: -10,
    zIndex: 2,
  },
  reportIconLarge: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCopy: {
    flex: 1,
    minWidth: 0,
  },
  reportTitle: {
    fontSize: 13,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  reportBody: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 2,
  },
  submitReportButton: {
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    ...hardShadow(2),
  },
  submitReportText: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  backButton: {
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...hardShadow(2),
  },
  backButtonText: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
