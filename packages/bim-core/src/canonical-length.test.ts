import { describe, expect, it } from 'vitest';
import {
  canonicalLength,
  quantiseMillimetres,
  quantiseMetres,
  canonicalLengthsAreEqual,
  canonicalToMillimetres,
  canonicalToMetres,
  addCanonicalLengths,
  subtractCanonicalLengths,
  scaleCanonicalLength,
  expectCanonicalLength,
  MAX_PROJECT_EXTENT_MICROMETRES,
  MICROMETRES_PER_MILLIMETRE,
} from './canonical-length';

const um = (value: number) => expectCanonicalLength(canonicalLength(value));

describe('canonicalLength', () => {
  it('accepts a whole number of micrometres', () => {
    expect(canonicalLength(3_000)).toEqual({ status: 'ok', value: 3_000 });
  });

  /**
   * Rejecting rather than rounding: a caller holding a fractional micrometre
   * has a unit bug, and rounding it would hide the bug while storing something
   * other than what the caller believes it stored.
   */
  it('rejects a fractional micrometre instead of quietly rounding it', () => {
    expect(canonicalLength(3_000.5)).toMatchObject({
      status: 'rejected',
      reason: 'not-an-integer',
    });
  });

  it.each([[NaN], [Infinity], [-Infinity]])('rejects %p', (value) => {
    expect(canonicalLength(value)).toMatchObject({ status: 'rejected', reason: 'not-finite' });
  });

  it('accepts a value at the project extent and rejects one beyond it', () => {
    expect(canonicalLength(MAX_PROJECT_EXTENT_MICROMETRES).status).toBe('ok');
    expect(canonicalLength(-MAX_PROJECT_EXTENT_MICROMETRES).status).toBe('ok');
    expect(canonicalLength(MAX_PROJECT_EXTENT_MICROMETRES + 1)).toMatchObject({
      status: 'rejected',
      reason: 'outside-project-extent',
    });
  });

  /**
   * The measured claim from scripts/run-canonical-units-spike.mjs: the extent
   * sits far below the exactly-representable range, so intermediate values do
   * not silently leave it.
   */
  it('keeps the project extent well inside the exactly-representable range', () => {
    expect(MAX_PROJECT_EXTENT_MICROMETRES).toBeLessThan(Number.MAX_SAFE_INTEGER / 1000);
  });
});

describe('quantisation', () => {
  it('converts millimetres onto the canonical grid', () => {
    expect(quantiseMillimetres(2.5)).toEqual({ status: 'ok', value: 2_500 });
  });

  it('converts metres onto the canonical grid', () => {
    expect(quantiseMetres(1.5)).toEqual({ status: 'ok', value: 1_500_000 });
  });

  /** Rounding is correct here, and only here: this is the float-to-exact boundary. */
  it('rounds a continuous measurement to the nearest micrometre', () => {
    expect(quantiseMillimetres(1 / 3)).toEqual({ status: 'ok', value: 333 });
  });

  it('rejects a non-finite measurement rather than producing NaN micrometres', () => {
    expect(quantiseMillimetres(NaN)).toMatchObject({ status: 'rejected', reason: 'not-finite' });
    expect(quantiseMetres(Infinity)).toMatchObject({ status: 'rejected', reason: 'not-finite' });
  });

  it('rejects a measurement that would land outside the project extent', () => {
    expect(quantiseMetres(200_000)).toMatchObject({
      status: 'rejected',
      reason: 'outside-project-extent',
    });
  });
});

describe('canonical equality', () => {
  /** Exact, because both operands are on the grid. The point of the whole decision. */
  it('compares exactly, with no epsilon', () => {
    expect(canonicalLengthsAreEqual(um(300_000), um(300_000))).toBe(true);
    expect(canonicalLengthsAreEqual(um(300_000), um(300_001))).toBe(false);
  });

  /**
   * The property float64 millimetres fails, measured in the spike: 300 reached
   * by one addition and by 3000 additions of 0.1 are not the same float. On the
   * canonical grid they are the same integer, which is what makes a semantic
   * hash usable as proof that a migration preserved meaning.
   */
  it('makes geometry reached by different routes compare identical', () => {
    const direct = expectCanonicalLength(quantiseMillimetres(300));

    let summed = 0;
    const step = expectCanonicalLength(quantiseMillimetres(0.1));
    for (let i = 0; i < 3000; i += 1) {
      summed += step;
    }

    expect(canonicalLengthsAreEqual(direct, um(summed))).toBe(true);

    // The same computation in float millimetres does not agree with itself.
    let floatSummed = 0;
    for (let i = 0; i < 3000; i += 1) floatSummed += 0.1;
    expect(floatSummed).not.toBe(300);
  });
});

describe('arithmetic', () => {
  it('adds and subtracts exactly', () => {
    expect(addCanonicalLengths(um(1_000), um(2_500))).toEqual({ status: 'ok', value: 3_500 });
    expect(subtractCanonicalLengths(um(2_500), um(1_000))).toEqual({ status: 'ok', value: 1_500 });
  });

  /**
   * The extent limit is about the project, not each input: two in-range
   * coordinates can sum to something outside it.
   */
  it('rechecks the extent on a sum of two in-range values', () => {
    const large = um(MAX_PROJECT_EXTENT_MICROMETRES);
    expect(addCanonicalLengths(large, um(1))).toMatchObject({
      status: 'rejected',
      reason: 'outside-project-extent',
    });
  });

  it('returns to the exact starting value after a move and a move back', () => {
    const start = expectCanonicalLength(quantiseMillimetres(1000));
    const offset = expectCanonicalLength(quantiseMillimetres(1 / 3));

    const moved = expectCanonicalLength(addCanonicalLengths(start, offset));
    const returned = expectCanonicalLength(subtractCanonicalLengths(moved, offset));

    expect(returned).toBe(start);
  });

  it('accumulates no drift over many transforms', () => {
    const step = expectCanonicalLength(quantiseMillimetres(0.1));
    let value = 0;
    for (let i = 0; i < 10_000; i += 1) value += step;
    for (let i = 0; i < 10_000; i += 1) value -= step;

    expect(value).toBe(0);
  });

  it('quantises a scaled length back onto the grid', () => {
    expect(scaleCanonicalLength(um(1_000), 1 / 3)).toEqual({ status: 'ok', value: 333 });
  });

  it('rejects a non-finite scale factor', () => {
    expect(scaleCanonicalLength(um(1_000), NaN)).toMatchObject({
      status: 'rejected',
      reason: 'not-finite',
    });
  });
});

describe('conversion out', () => {
  it('converts to millimetres and metres for display', () => {
    expect(canonicalToMillimetres(um(2_500))).toBe(2.5);
    expect(canonicalToMetres(um(1_500_000))).toBe(1.5);
  });

  it('round-trips a millimetre value through the canonical grid', () => {
    const value = expectCanonicalLength(quantiseMillimetres(123.456));
    expect(canonicalToMillimetres(value)).toBe(123.456);
    expect(value).toBe(123_456 * (MICROMETRES_PER_MILLIMETRE / 1000));
  });
});

describe('expectCanonicalLength', () => {
  it('throws rather than returning a wrong number', () => {
    expect(() => expectCanonicalLength(canonicalLength(1.5))).toThrow(/not-an-integer/);
  });
});
