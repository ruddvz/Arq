/**
 * Time and identity are injected, never reached for.
 *
 * Everything in this package that expires - a grant, a staged proposal, an
 * idempotency record, a cursor - depends on "now", and everything that
 * correlates a call depends on a fresh identifier. Calling `Date.now()` and
 * `randomUUID()` inline, as the reviewed 2.0 package did, makes expiry and
 * replay behaviour untestable except by sleeping, which is why 2.0 declared
 * `expired` and `superseded` proposal states that no test could reach and
 * no code path produced.
 *
 * With both injected, a test advances a clock by a millisecond and asserts
 * the exact boundary, and every generated identifier in a test run is
 * reproducible.
 */

export type Clock = () => number;

export type IdSource = () => string;

export const systemClock: Clock = () => Date.now();

/** A clock a test can move deliberately. `advance` is the only way time passes. */
export interface ControlledClock {
  readonly now: Clock;
  advance(milliseconds: number): void;
  set(epochMilliseconds: number): void;
}

export function createControlledClock(startEpochMilliseconds = 0): ControlledClock {
  let current = startEpochMilliseconds;
  return {
    now: () => current,
    advance(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new RangeError('a controlled clock only moves forward by a finite amount');
      }
      current += milliseconds;
    },
    set(epochMilliseconds) {
      if (!Number.isFinite(epochMilliseconds)) {
        throw new RangeError('a controlled clock must be set to a finite time');
      }
      current = epochMilliseconds;
    },
  };
}

/**
 * Sequential identifiers with a stable prefix.
 *
 * Used as the default in tests and as the trace source when an operator
 * has asked for reproducible logs. It is deliberately not the production
 * default: predictable trace identifiers let one caller guess another's.
 */
export function createSequentialIdSource(prefix: string): IdSource {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter.toString().padStart(6, '0')}`;
  };
}

/** ISO-8601 in UTC with millisecond precision, from an injected clock rather than a fresh Date. */
export function isoTimestamp(clock: Clock): string {
  return new Date(clock()).toISOString();
}
