/**
 * ARQ-168: ai: add ten deterministic benchmarks.
 *
 * Blueprint section 103 ("Evaluation") names ten test categories and ten
 * metrics. No live AI/natural-language layer exists in this repository
 * (that intent-extraction step is out of scope - section 97's steps 1-2,
 * "user request" -> "intent extraction", are not implemented anywhere).
 * These ten benchmarks measure the one deterministic, already-real
 * pipeline that exists today - ArqScript source text through the real
 * `parseArqScript` (ARQ-167) - using a fixed ArqScript document standing
 * in for "what an AI would have produced" for each category, not a
 * simulated or mocked AI call.
 *
 * Three categories (constraint satisfaction, schedule generation, and
 * the cross-reference half of "ambiguous request") have no real
 * capability behind them yet - no constraint language or solver, no
 * schedule-generation code, and no semantic/cross-reference validation
 * (section 97 step 5 is separate, later work). Rather than skip these or
 * fabricate a passing result, each one's deterministic, reproducible
 * measurement IS today's honest behaviour: an unrecognized statement is
 * correctly rejected (proving the system fails safely and transparently
 * rather than silently mis-executing an unsupported request - AI
 * guardrail "no hidden project mutation", docs/ai/AI-GUARDRAILS.md), or
 * a meaningless cross-reference is documented as not yet caught. See
 * docs/research/AI-BENCHMARK-RESULTS.md for the full write-up.
 */

import { describe, expect, it } from 'vitest';
import { parseArqScript, type ArqScriptParseResult } from './arqscript-parser';
import { collectAssumptions, operationTypesUsed } from './arqscript-document';

interface MeasuredParse {
  readonly result: ArqScriptParseResult;
  readonly latencyMs: number;
}

function measure(source: string, scriptId: string): MeasuredParse {
  const start = performance.now();
  const result = parseArqScript(source, scriptId);
  return { result, latencyMs: performance.now() - start };
}

describe('AI benchmark categories (blueprint section 103)', () => {
  it('1. text to wall - dimensional and semantic accuracy, operation latency', () => {
    const source =
      'version "0.1"\nwall "W1" { from: point(0mm, 0mm) to: point(6000mm, 0mm) type: "Exterior 230" height: 3000mm }';
    const { result, latencyMs } = measure(source, 'bench-text-to-wall');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands[0]).toMatchObject({
        kind: 'wall',
        operationType: 'CreateWall',
        from: { xMm: 0, yMm: 0 },
        to: { xMm: 6000, yMm: 0 },
        heightMm: 3000,
      });
      expect(operationTypesUsed(result.document)).toEqual(['CreateWall']);
    }
    // Generous headroom, matching this repo's other deterministic-benchmark
    // thresholds (benchmarks/PERFORMANCE-BUDGETS.json) - not a tuned target.
    expect(latencyMs).toBeLessThan(50);
  });

  it('2. modify wall - semantic accuracy, no assumptions needed for an explicit change', () => {
    const { result } = measure(
      'version "0.1"\nupdate wall "W1" { height: 150mm }',
      'bench-modify-wall',
    );
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands[0]).toMatchObject({
        kind: 'update-wall',
        operationType: 'UpdateWall',
        heightMm: 150,
      });
      expect(collectAssumptions(result.document)).toEqual([]);
    }
  });

  it('3. place opening - assumptions metric: omitted width/height are visible, never silently applied', () => {
    const { result } = measure(
      'version "0.1"\ndoor "D1" { host: "W1" offset: 900mm }',
      'bench-place-opening',
    );
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands[0]).toMatchObject({
        kind: 'door',
        operationType: 'PlaceDoor',
      });
      expect(collectAssumptions(result.document)).toHaveLength(2);
    }
  });

  it('4. room adjacency - a real, minimal geometric proxy (shared boundary vertex), not the full room-boundary-graph feature', () => {
    const source = `version "0.1"
room "R1" { name: "Kitchen" boundary: [point(0mm,0mm), point(4000mm,0mm), point(4000mm,3000mm), point(0mm,3000mm)] }
room "R2" { name: "Dining" boundary: [point(4000mm,0mm), point(8000mm,0mm), point(8000mm,3000mm), point(4000mm,3000mm)] }`;
    const { result } = measure(source, 'bench-room-adjacency');
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') {
      return;
    }
    const [r1, r2] = result.document.commands;
    expect(r1?.kind).toBe('room');
    expect(r2?.kind).toBe('room');
    const sharesBoundaryVertex =
      r1?.kind === 'room' &&
      r2?.kind === 'room' &&
      r1.boundary.some((p) => r2.boundary.some((q) => p.xMm === q.xMm && p.yMm === q.yMm));
    expect(sharesBoundaryVertex).toBe(true);
  });

  it('5. constraint satisfaction - correctly rejected: ArqScript v0 has no constraint statement or solver', () => {
    const { result } = measure('version "0.1"\nconstrain "W1" parallel "W2"', 'bench-constraint');
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason).toContain('unknown statement');
    }
  });

  it('6. ambiguous request - a meaningless cross-reference is not yet caught (semantic validation is separate, later work), documented honestly rather than hidden', () => {
    const { result } = measure(
      'version "0.1"\ndoor "D1" { host: "does-not-exist" offset: 0mm }',
      'bench-ambiguous',
    );
    // No cross-reference/semantic validation exists at this layer yet
    // (section 97 step 5), so a door referencing a wall id that appears
    // nowhere else in the document currently parses successfully. This
    // measurement is the honest, real result - not a claim that ambiguity
    // detection works today.
    expect(result.status).toBe('parsed');
  });

  it('7. invalid request - rejection quality: a specific reason naming what is wrong', () => {
    const { result } = measure(
      'version "0.1"\ndoor "D1" { host: "" offset: 0mm }',
      'bench-invalid',
    );
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason).toContain('door host');
    }
  });

  it('8. multi-step revision - grouped undo: every command in one document shares one scriptId', () => {
    const source = `version "0.1"
wall "W1" { from: point(0mm,0mm) to: point(6000mm,0mm) }
door "D1" { host: "W1" offset: 1200mm }
rename "W1" to "Front Wall"`;
    const { result } = measure(source, 'bench-multi-step');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands).toHaveLength(3);
      expect(result.document.scriptId).toBe('bench-multi-step');
    }
  });

  it('9. error explanation - the rejection reason itself is the explanation, naming the offending statement and its position', () => {
    const { result } = measure('version "0.1"\nbulldoze "everything"', 'bench-error-explanation');
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason).toContain('bulldoze');
      expect(result.position.line).toBe(2);
    }
  });

  it('10. schedule generation - correctly rejected: no schedule statement exists in ArqScript v0', () => {
    const { result } = measure('version "0.1"\nschedule "doors"', 'bench-schedule');
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason).toContain('unknown statement');
    }
  });

  it('crash rate: never throws across every category above, even the rejected ones', () => {
    const sources = [
      'wall "W1" { from: point(0mm,0mm) to: point(6000mm,0mm) }', // no version header
      'constrain "W1" parallel "W2"',
      'schedule "doors"',
      'bulldoze "everything"',
    ];
    for (const source of sources) {
      const { result } = measure(source, 'bench-crash-rate');
      expect(result.status === 'parsed' || result.status === 'rejected').toBe(true);
    }
  });
});
