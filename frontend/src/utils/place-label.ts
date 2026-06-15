/**
 * Human-friendly place labels.
 *
 * Walking legs (and a journey that starts from "Current Location" or a raw
 * lat/lon input) can carry bare coordinate strings as their departure/arrival
 * names and inside their "Walk from … to …" instruction — e.g.
 * `51.6031,-0.1247`. Those leak onto the step timeline and map popups and read
 * as gibberish to a traveller. These helpers replace coordinate noise with
 * plain language so every step is self-explanatory.
 */

// A lat,lon pair anywhere in a string, e.g. "51.6031, -0.1247" (3+ decimals so
// we don't clobber things like a bus line "12.5").
const COORD_PAIR = /-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g;

/** True when the whole (trimmed) label is just a coordinate pair. */
export function isCoordinateLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  const trimmed = label.trim();
  COORD_PAIR.lastIndex = 0;
  const match = COORD_PAIR.exec(trimmed);
  return match != null && match[0].length === trimmed.length;
}

/**
 * A place name fit to show a traveller. If the label is empty or just a
 * coordinate pair, return `fallback` (e.g. "your location" / "your
 * destination"). Otherwise strip any embedded coordinate pair and tidy up.
 */
export function cleanPlaceLabel(
  label: string | null | undefined,
  fallback = 'your location',
): string {
  if (!label || isCoordinateLabel(label)) return fallback;
  const stripped = label.replace(COORD_PAIR, '').replace(/\s{2,}/g, ' ').trim();
  // Drop dangling separators left behind once a coordinate was removed.
  const tidy = stripped.replace(/^[,\-–—\s]+|[,\-–—\s]+$/g, '').trim();
  return tidy.length > 0 ? tidy : fallback;
}

/**
 * A step instruction fit to show a traveller. Replaces any coordinate pair
 * inside the instruction (e.g. "Walk from 51.60,-0.12 to Vue") with a plain
 * phrase so the sentence still reads naturally.
 */
export function cleanInstruction(instruction: string | null | undefined): string {
  if (!instruction) return '';
  return instruction
    .replace(COORD_PAIR, 'your location')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** A leg as far as a change instruction cares about it. */
type ChangeLeg = { mode: string; line?: string; departure?: string; arrival?: string };

const isWalkMode = (mode: string) => {
  const m = (mode || '').toLowerCase();
  return m === 'walking' || m === 'walk';
};
const isBusMode = (mode: string) => {
  const m = (mode || '').toLowerCase();
  return m === 'bus' || m === 'coach' || m.includes('bus');
};

/** A human phrase for a leg's mode, e.g. "Bus 49", "the Circle line", "the train". */
function describeMode(mode: string, line?: string): string {
  const m = (mode || '').toLowerCase();
  if (isWalkMode(m)) return 'walking';
  if (isBusMode(m)) return line ? `Bus ${line}` : 'the bus';
  if (m === 'tube' || m === 'subway' || m === 'underground') return line ? `the ${line} line` : 'the Tube';
  if (m === 'dlr') return line ? `the ${line}` : 'the DLR';
  if (m === 'tram') return line ? `the ${line}` : 'the tram';
  if (m === 'overground' || m === 'train' || m === 'national-rail' || m.includes('elizabeth')) {
    return line ? `the ${line}` : 'the train';
  }
  return line || (m ? m.charAt(0).toUpperCase() + m.slice(1) : 'transit');
}

/**
 * A readable, human instruction for an interchange between two legs, e.g.
 *  - transit → walk:  "From the Circle line, start walking to Imperial College"
 *  - walk → transit:  "Walk to Baker Street, then take the Jubilee line"
 *  - bus → bus:       "Switch Bus 49 to Bus C1 at Clapham Junction"
 *  - transit → transit: "From the Circle line take the Jubilee line at Baker Street"
 */
export function buildChangeInstruction(from: ChangeLeg, to: ChangeLeg): string {
  const station = cleanPlaceLabel(to.departure || from.arrival, 'the change');
  if (isWalkMode(to.mode)) {
    const dest = cleanPlaceLabel(to.arrival, 'your destination');
    return `From ${describeMode(from.mode, from.line)}, start walking to ${dest}`;
  }
  if (isWalkMode(from.mode)) {
    return `Walk to ${station}, then take ${describeMode(to.mode, to.line)}`;
  }
  if (isBusMode(from.mode) && isBusMode(to.mode)) {
    return `Switch ${describeMode(from.mode, from.line)} to ${describeMode(to.mode, to.line)} at ${station}`;
  }
  return `From ${describeMode(from.mode, from.line)} take ${describeMode(to.mode, to.line)} at ${station}`;
}
