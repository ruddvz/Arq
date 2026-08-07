/**
 * Which tint a room takes, derived from what it is called.
 *
 * The reference plans read as architecture partly because the rooms are not one
 * flat colour: living space, cooking, sleeping, wet rooms and outdoor space are
 * each their own quiet wash, so the plan can be understood before a single label
 * is read.
 *
 * This is a heuristic on free text, and that is worth stating rather than
 * hiding. `Room` carries a name and no type, department or occupancy field, so
 * there is nothing else to classify by. A room named in another language, or
 * named "Zone 4", falls to the neutral tint - which is the correct failure: an
 * unrecognised room is drawn as a room, not as a guess about what happens in it.
 *
 * The categories are deliberately coarse. A finer set would be more often wrong
 * and no more useful at 1:100, and the moment `Room` gains a real type field
 * this should read that instead and this file should shrink to a mapping.
 */

export type RoomTint =
  | 'room-living'
  | 'room-cooking'
  | 'room-dining'
  | 'room-sleeping'
  | 'room-wet'
  | 'room-service'
  | 'room-circulation'
  | 'room-outdoor'
  | 'room-neutral';

/**
 * Ordered, and the order matters: the first match wins, so the more specific
 * words come first. "Guest ensuite" is a wet room before it is a sleeping one,
 * and "Utility" is service before anything else claims it.
 */
const PATTERNS: readonly (readonly [RegExp, RoomTint])[] = [
  [/\b(courtyard|terrace|balcony|deck|garden|patio|yard|roof\s*terrace)\b/i, 'room-outdoor'],
  [/\b(ensuite|bathroom|shower|powder|wc|toilet|washroom)\b/i, 'room-wet'],
  [/\b(utility|laundry|pantry|store|storage|linen|closet|plant|garage|mud|bin)\b/i, 'room-service'],
  [
    /\b(hall|foyer|lobby|corridor|passage|stair|landing|gallery|entry|vestibule)\b/i,
    'room-circulation',
  ],
  [/\b(bedroom|bed|nursery|dorm)\b/i, 'room-sleeping'],
  [/\b(kitchen|kitchenette|scullery)\b/i, 'room-cooking'],
  [/\b(dining|breakfast)\b/i, 'room-dining'],
  [/\b(living|lounge|family|sitting|study|office|snug|den|library|media)\b/i, 'room-living'],
];

export function roomTint(name: string): RoomTint {
  for (const [pattern, tint] of PATTERNS) {
    if (pattern.test(name)) return tint;
  }
  return 'room-neutral';
}
