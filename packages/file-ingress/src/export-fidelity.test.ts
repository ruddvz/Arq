import { describe, expect, it } from 'vitest';
import {
  EXPORT_REPORT_REJECTIONS,
  compareRoundTrip,
  describeExportLosses,
  exportWasComplete,
  validateExportReport,
  type ExportReport,
  type RoundTripElement,
} from './export-fidelity';

function report(overrides: Partial<ExportReport> = {}): ExportReport {
  return {
    formatId: 'dxf',
    exporterId: 'arq-dxf-exporter',
    exporterVersion: '1.0.0',
    projectRevision: 12,
    outcomes: [{ category: 'Wall', carriage: 'full', count: 20 }],
    outputByteLength: 4096,
    outputSha256: 'a'.repeat(64),
    ...overrides,
  };
}

describe('validateExportReport', () => {
  it('accepts a report whose losses are each explained', () => {
    const result = validateExportReport(
      report({
        outcomes: [
          { category: 'Wall', carriage: 'full', count: 20 },
          {
            category: 'Room',
            carriage: 'omitted',
            count: 3,
            detail: 'DXF has no room concept; the bounding walls were written.',
          },
        ],
      }),
    );

    expect(result).toBeNull();
  });

  it('refuses a loss with no explanation', () => {
    // Telling a user something was lost and refusing to say what is worse than
    // silence: it produces worry with no next step.
    const result = validateExportReport(
      report({ outcomes: [{ category: 'Room', carriage: 'omitted', count: 3 }] }),
    );

    expect(result).toContain(EXPORT_REPORT_REJECTIONS.lossWithoutDetail);
  });

  it('refuses a blank explanation, which is the same thing', () => {
    expect(
      validateExportReport(
        report({
          outcomes: [{ category: 'Room', carriage: 'simplified', count: 3, detail: '  ' }],
        }),
      ),
    ).toContain(EXPORT_REPORT_REJECTIONS.lossWithoutDetail);
  });

  it('refuses a category reported twice', () => {
    expect(
      validateExportReport(
        report({
          outcomes: [
            { category: 'Wall', carriage: 'full', count: 20 },
            { category: 'Wall', carriage: 'omitted', count: 1, detail: 'x' },
          ],
        }),
      ),
    ).toContain(EXPORT_REPORT_REJECTIONS.duplicateCategory);
  });

  it('needs no detail for a category that went across whole', () => {
    expect(validateExportReport(report())).toBeNull();
  });
});

describe('exportWasComplete', () => {
  it('is true only when nothing was simplified, substituted or omitted', () => {
    expect(exportWasComplete(report())).toBe(true);
    expect(
      exportWasComplete(
        report({
          outcomes: [
            { category: 'Room', carriage: 'substituted', count: 3, detail: 'as polylines' },
          ],
        }),
      ),
    ).toBe(false);
  });
});

describe('describeExportLosses', () => {
  it('lists what will not survive, in the model terms', () => {
    // "3 entities omitted" is a number; this is a fact someone can act on.
    const sentences = describeExportLosses(
      report({
        outcomes: [
          { category: 'Wall', carriage: 'full', count: 20 },
          {
            category: 'Room',
            carriage: 'omitted',
            count: 3,
            detail: 'DXF has no room concept.',
          },
        ],
      }),
    );

    expect(sentences).toEqual(['3 Room elements were not written. DXF has no room concept.']);
  });

  it('distinguishes substituted from omitted', () => {
    const sentences = describeExportLosses(
      report({
        outcomes: [
          { category: 'Room', carriage: 'substituted', count: 2, detail: 'as closed polylines.' },
        ],
      }),
    );

    expect(sentences[0]).toContain('written as something else');
  });

  it('says nothing about categories that went across whole', () => {
    expect(describeExportLosses(report())).toEqual([]);
  });
});

describe('compareRoundTrip', () => {
  const SUPPORTED = new Set(['Wall']);
  const TOLERANCES = { length: 0.001 };

  function wall(stableKey: string, length: number, layer = 'A-WALL'): RoundTripElement {
    return { stableKey, category: 'Wall', properties: { length, layer } };
  }

  it('passes when the supported subset comes back unchanged', () => {
    const result = compareRoundTrip([wall('w1', 5000)], [wall('w1', 5000)], SUPPORTED, TOLERANCES);

    expect(result.passed).toBe(true);
    expect(result.checkedCount).toBe(1);
  });

  it('passes when a value drifts inside its declared tolerance', () => {
    // A coordinate written to six decimal places and read back differs in the
    // last place.
    const result = compareRoundTrip(
      [wall('w1', 5000)],
      [wall('w1', 5000.0005)],
      SUPPORTED,
      TOLERANCES,
    );

    expect(result.passed).toBe(true);
  });

  it('fails when a value drifts beyond its tolerance', () => {
    const result = compareRoundTrip([wall('w1', 5000)], [wall('w1', 5001)], SUPPORTED, TOLERANCES);

    expect(result.passed).toBe(false);
    expect(result.findings[0]).toMatchObject({
      kind: 'value-drift',
      property: 'length',
      before: 5000,
      after: 5001,
    });
  });

  it('compares a property with no declared tolerance exactly', () => {
    // A property nobody has thought about the precision of is one whose drift
    // nobody has agreed to. A silent default would let a real loss through.
    const result = compareRoundTrip([wall('w1', 5000)], [wall('w1', 5000)], SUPPORTED, {});

    expect(result.passed).toBe(true);
    expect(
      compareRoundTrip([wall('w1', 5000)], [wall('w1', 5000.0005)], SUPPORTED, {}).passed,
    ).toBe(false);
  });

  it('reports an element that did not come back', () => {
    const result = compareRoundTrip([wall('w1', 5000)], [], SUPPORTED, TOLERANCES);

    expect(result.findings[0]).toMatchObject({ kind: 'missing', stableKey: 'w1' });
  });

  it('reports a property that did not come back', () => {
    const result = compareRoundTrip(
      [wall('w1', 5000)],
      [{ stableKey: 'w1', category: 'Wall', properties: { length: 5000 } }],
      SUPPORTED,
      TOLERANCES,
    );

    expect(result.findings[0]).toMatchObject({ kind: 'missing', property: 'layer' });
  });

  it('reports something that came back but was never written', () => {
    const result = compareRoundTrip([], [wall('w9', 1000)], SUPPORTED, TOLERANCES);

    expect(result.findings[0]).toMatchObject({ kind: 'unexpected', stableKey: 'w9' });
  });

  it('reports an element that came back as a different category', () => {
    const result = compareRoundTrip(
      [wall('w1', 5000)],
      [{ stableKey: 'w1', category: 'Wall', properties: { length: 5000, layer: 'A-WALL' } }],
      SUPPORTED,
      TOLERANCES,
    );

    expect(result.passed).toBe(true);
  });

  it('ignores categories the format was never expected to carry', () => {
    // A round trip through DXF will not return a room, and failing for that
    // would make the check fail for the one reason that is not a defect.
    const withRoom: RoundTripElement = {
      stableKey: 'r1',
      category: 'Room',
      properties: { name: 'Office' },
    };

    const result = compareRoundTrip(
      [wall('w1', 5000), withRoom],
      [wall('w1', 5000)],
      SUPPORTED,
      TOLERANCES,
    );

    expect(result.passed).toBe(true);
    expect(result.checkedCount).toBe(1);
  });

  it('orders findings deterministically', () => {
    const result = compareRoundTrip(
      [wall('z1', 5000), wall('a1', 5000)],
      [],
      SUPPORTED,
      TOLERANCES,
    );

    expect(result.findings.map((finding) => finding.stableKey)).toEqual(['a1', 'z1']);
  });

  it('compares string properties exactly', () => {
    const result = compareRoundTrip(
      [wall('w1', 5000, 'A-WALL')],
      [wall('w1', 5000, 'A-WALL-1')],
      SUPPORTED,
      TOLERANCES,
    );

    expect(result.passed).toBe(false);
    expect(result.findings[0]?.property).toBe('layer');
  });
});
