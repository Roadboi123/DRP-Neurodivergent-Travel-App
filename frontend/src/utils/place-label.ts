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
