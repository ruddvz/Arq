import { describe, expect, it } from 'vitest';
import { length } from './length';
import { PROVISIONAL_STAIR_LIMITS, riserHeightMm, treadCount, validateStairFlight } from './stair';

describe('validateStairFlight', () => {
  it('accepts a comfortable flight', () => {
    // 16 risers over 2800mm gives 175mm risers; 2R+T = 625mm.
    const findings = validateStairFlight({ riserCount: 16 }, length(275, 'mm'), length(2800, 'mm'));

    expect(findings).toEqual([]);
  });

  it('rejects a non-integer or non-positive riser count without cascading', () => {
    const fractional = validateStairFlight(
      { riserCount: 15.5 },
      length(275, 'mm'),
      length(2800, 'mm'),
    );

    // A count that cannot divide the rise makes every downstream finding
    // meaningless, so exactly one finding comes back, not four.
    expect(fractional).toHaveLength(1);
    expect(fractional[0]?.code).toBe('riser-count-invalid');
    expect(fractional[0]?.provisional).toBe(false);

    expect(
      validateStairFlight({ riserCount: 0 }, length(275, 'mm'), length(2800, 'mm')),
    ).toHaveLength(1);
  });

  it('reports a riser that is too tall', () => {
    // 12 risers over 2800mm is 233mm each.
    const findings = validateStairFlight({ riserCount: 12 }, length(275, 'mm'), length(2800, 'mm'));
    const codes = findings.map((finding) => finding.code);

    expect(codes).toContain('riser-too-tall');
  });

  it('reports a tread that is too shallow', () => {
    const findings = validateStairFlight({ riserCount: 16 }, length(200, 'mm'), length(2800, 'mm'));
    const codes = findings.map((finding) => finding.code);

    expect(codes).toContain('tread-too-shallow');
  });

  it('marks limit-derived findings provisional so a surface cannot present them as compliance', () => {
    const findings = validateStairFlight({ riserCount: 12 }, length(275, 'mm'), length(2800, 'mm'));

    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((finding) => finding.provisional)).toBe(true);
  });

  it('reports an uncomfortable proportion even when riser and tread are individually legal', () => {
    // 20 risers over 2800mm is 140mm each - inside the riser band either way.
    // With a 400mm tread, 2R+T is 680mm and comfortable; with a 450mm tread it
    // is 730mm and is not. Neither dimension changes legality on its own, which
    // is exactly why the proportion needs its own check.
    const comfortable = validateStairFlight(
      { riserCount: 20 },
      length(400, 'mm'),
      length(2800, 'mm'),
    );
    const stretched = validateStairFlight(
      { riserCount: 20 },
      length(450, 'mm'),
      length(2800, 'mm'),
    );

    expect(comfortable).toEqual([]);
    expect(stretched.map((finding) => finding.code)).toEqual(['proportion-uncomfortable']);
  });
});

describe('riserHeightMm', () => {
  it('divides the rise the levels fix, so the flight lands exactly', () => {
    expect(riserHeightMm(length(2800, 'mm'), 16)).toBe(175);
  });
});

describe('treadCount', () => {
  it('is one fewer than the riser count: the top landing is the last step', () => {
    expect(treadCount(16)).toBe(15);
    expect(treadCount(1)).toBe(0);
  });
});

describe('PROVISIONAL_STAIR_LIMITS', () => {
  it('brackets riser height rather than fixing it, since the real limits come from a code profile', () => {
    expect(PROVISIONAL_STAIR_LIMITS.minRiserHeightMm).toBeLessThan(
      PROVISIONAL_STAIR_LIMITS.maxRiserHeightMm,
    );
  });
});
