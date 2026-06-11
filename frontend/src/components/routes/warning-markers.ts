import { Ionicons } from '@expo/vector-icons';

import { getAccents } from '@/constants/theme';
import type { WarningItem } from '@/types/route';

type Accents = ReturnType<typeof getAccents>;

/**
 * The sensory categories a traveller can report, and how each looks on the map.
 * `icon` is the Ionicon stored on the warning when reported; `emoji`/`accent`
 * drive the round Waze-style markers. Shared so the journey screen and the
 * pre-Go route details show identical markers.
 */
export const REPORT_OPTIONS: {
  type: 'sound' | 'heat' | 'smell' | 'crowds' | 'other';
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

export type SensoryReportType = (typeof REPORT_OPTIONS)[number]['type'];

/**
 * Map a warning's stored `icon` (an Ionicon name) to the marker emoji and an
 * accent-ramp colour, so markers stay readable in both themes. Unknown icons
 * fall back to the generic "other" look.
 */
export function warningVisual(icon: string, accents: Accents): { emoji: string; color: string } {
  const option =
    REPORT_OPTIONS.find((o) => o.icon === icon) ?? REPORT_OPTIONS[REPORT_OPTIONS.length - 1];
  return { emoji: option.emoji, color: accents[option.accent] };
}

/** The shape pushed to the Leaflet map for each marker. */
export type FormattedWarning = {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  color: string;
  lat: number | null | undefined;
  lon: number | null | undefined;
  hidden: boolean;
};

/**
 * Project user-reported warnings into map markers. A warning is `hidden` when
 * the user dismissed it individually, or when the whole layer is toggled off.
 */
export function formatWarnings(
  warnings: WarningItem[],
  accents: Accents,
  dismissedIds: Set<string>,
  hideAll: boolean,
): FormattedWarning[] {
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
      hidden: hideAll || dismissedIds.has(w.id),
    };
  });
}

/**
 * Leaflet script that defines `window.updateWarnings(json)` — the single source
 * of truth for the round sensory markers and their tap → React bridge. Embed it
 * in a map's `<script>`; the host page then drives it with `updateWarnings`
 * messages. Each host adds its own `message` listener (the journey map also
 * tracks user location), so this only owns the marker rendering.
 */
export function warningMarkerScript(): string {
  return `
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
  `;
}
