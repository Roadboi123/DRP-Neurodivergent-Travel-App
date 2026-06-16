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
  type: 'sound' | 'heat' | 'smell' | 'crowds' | 'light';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  emoji: string;
  accent: keyof Accents;
}[] = [
  { type: 'sound', label: 'Sound', icon: 'radio-outline', emoji: '🔊', accent: 'cyan' },
  { type: 'heat', label: 'Heat', icon: 'thermometer-outline', emoji: '🌡️', accent: 'pink' },
  { type: 'smell', label: 'Smell', icon: 'flower-outline', emoji: '👃', accent: 'green' },
  { type: 'crowds', label: 'Crowds', icon: 'people-outline', emoji: '👥', accent: 'orange' },
  { type: 'light', label: 'Light', icon: 'sunny-outline', emoji: '💡', accent: 'yellow' },
];

export type SensoryReportType = (typeof REPORT_OPTIONS)[number]['type'];

/**
 * Human description for a warning's action card, phrased by *where* it was
 * reported rather than "flagged here by a traveller" (which reads wrong when
 * you're viewing it from elsewhere on the route). The user's own report reads
 * "<thing> flagged by you near <place>"; another traveller's reads "<thing>
 * reported by a traveller near <place>". `place` is the nearest stop on the *viewer's* route
 * (pass `null`/omit when unknown → "nearby"). Live (non-user) warnings such as
 * TfL disruptions keep their stored description.
 */
export function warningDisplayDesc(
  w: { title?: string; desc: string; username?: string | null },
  username: string | null | undefined,
  place?: string | null,
): string {
  const label = (w.title || '').replace(/\s+reported$/i, '').trim() || 'Warning';
  const near = place ? ` near ${place}` : ' nearby';
  // Logged-out users report under "anonymous", so compare against that too.
  const isOwn = !!w.username && w.username === (username || 'anonymous');
  if (isOwn) {
    return `${label} flagged by you${near}`;
  }
  if (w.username) {
    // Another traveller's community report — attribute generically and locate
    // it by place, never "here" (the viewer may be elsewhere on the route).
    return `${label} reported by a traveller${near}`;
  }
  // A live system warning (TfL disruption etc.) keeps its stored description.
  return w.desc;
}

// Walking is drawn as a dotted line in this blue so the map legend can say
// plainly "blue = walking" (distinct from the transit liveries). Shared by the
// journey map and the pre-Go route-details map.
export const WALK_BLUE = '#2e6bff';

/** A transport-mode emoji for the white "change here" markers + the map legend. */
export function modeEmoji(mode: string | null | undefined): string {
  const m = (mode || '').toLowerCase();
  if (m === 'walking' || m === 'walk') return '🚶';
  if (m.includes('bus') || m === 'coach') return '🚌';
  if (m === 'tube' || m === 'subway' || m === 'underground' || m.includes('elizabeth')) return '🚇';
  if (m === 'dlr') return '🚈';
  if (m === 'tram') return '🚊';
  if (m === 'overground' || m === 'train' || m === 'national-rail') return '🚆';
  return '🚉';
}

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
  // Severity drives the marker's ring thickness/size (how strong the signal is);
  // reportCount drives the little count badge. Together they show, at a glance,
  // how heavily an area has been flagged.
  severity: WarningItem['severity'];
  reportCount: number;
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
      severity: w.severity,
      reportCount: w.report_count ?? 1,
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
    let warningMarkers = [];

    function _wmDistM(aLat, aLon, bLat, bLon) {
      const R = 6371000;
      const dLat = (bLat - aLat) * Math.PI / 180;
      const dLon = (bLon - aLon) * Math.PI / 180;
      const s = Math.sin(dLat/2)**2 + Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLon/2)**2;
      return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }

    function _wmPost(payload) {
      const msg = JSON.stringify(payload);
      if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); }
      else { window.parent.postMessage(msg, '*'); }
    }

    window.updateWarnings = function(warningsJson) {
      const warnings = JSON.parse(warningsJson);

      // Remove old markers
      warningMarkers.forEach((m) => map.removeLayer(m));
      warningMarkers = [];

      // Only visible, located warnings participate.
      const visible = warnings.filter((w) => w.lat != null && w.lon != null && !w.hidden);

      // Greedily cluster warnings within ~100m of each other so a busy area reads
      // as one stacked marker the user can open for a breakdown.
      const CLUSTER_RADIUS_M = 100;
      const used = new Array(visible.length).fill(false);
      const clusters = [];
      for (let i = 0; i < visible.length; i++) {
        if (used[i]) continue;
        const group = [visible[i]];
        used[i] = true;
        for (let j = i + 1; j < visible.length; j++) {
          if (used[j]) continue;
          if (_wmDistM(visible[i].lat, visible[i].lon, visible[j].lat, visible[j].lon) <= CLUSTER_RADIUS_M) {
            group.push(visible[j]);
            used[j] = true;
          }
        }
        clusters.push(group);
      }

      clusters.forEach((group) => {
        const lat = group.reduce((s, g) => s + g.lat, 0) / group.length;
        const lon = group.reduce((s, g) => s + g.lon, 0) / group.length;

        let html, size;
        if (group.length === 1) {
          const w = group[0];
          size = w.severity === 'high' ? 46 : w.severity === 'medium' ? 40 : 34;
          const ring = w.severity === 'high' ? 5 : w.severity === 'medium' ? 4 : 3;
          const emojiSize = Math.round(size * 0.45);
          const count = w.reportCount || 1;
          const badge = count > 1
            ? \`<div style="position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;background:#1d1c1c;color:#fff;border:2px solid #fff;border-radius:9px;font-size:10px;font-weight:700;line-height:14px;text-align:center;">\${count}</div>\`
            : '';
          html = \`<div style="background-color:\${w.color};width:\${size}px;height:\${size}px;border-radius:50%;border:\${ring}px solid #1d1c1c;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 6px rgba(0,0,0,0.3);position:relative;"><span style="font-size:\${emojiSize}px;">\${w.emoji}</span>\${badge}</div>\`;
        } else {
          // Stacked cluster: up to 3 emoji discs peeking from behind each other,
          // plus a total-count badge.
          size = 46;
          const discs = group.slice(0, 3).map((g, k) =>
            \`<div style="position:absolute;left:\${k * 16}px;top:0;width:30px;height:30px;border-radius:50%;background:\${g.color};border:3px solid #1d1c1c;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 5px rgba(0,0,0,0.3);z-index:\${10 - k};"><span style="font-size:14px;">\${g.emoji}</span></div>\`
          ).join('');
          const width = 30 + (Math.min(group.length, 3) - 1) * 16;
          const badge = \`<div style="position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;background:#1d1c1c;color:#fff;border:2px solid #fff;border-radius:9px;font-size:10px;font-weight:700;line-height:14px;text-align:center;z-index:20;">\${group.length}</div>\`;
          html = \`<div style="position:relative;width:\${width}px;height:30px;">\${discs}\${badge}</div>\`;
          size = width;
        }

        const icon = L.divIcon({
          html: html,
          className: 'warning-marker-icon',
          iconSize: [size, group.length === 1 ? size : 30],
          iconAnchor: [size / 2, group.length === 1 ? size / 2 : 15],
        });
        const marker = L.marker([lat, lon], { icon: icon }).addTo(map);

        marker.on('click', function() {
          if (group.length === 1) {
            _wmPost({ type: 'warningClick', id: group[0].id });
          } else {
            _wmPost({ type: 'warningClusterClick', ids: group.map((g) => g.id) });
          }
        });

        warningMarkers.push(marker);
      });
    };
  `;
}
