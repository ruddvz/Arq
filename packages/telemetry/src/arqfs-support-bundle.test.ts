import { describe, expect, it } from 'vitest';
import { buildArqfsSupportBundle } from './arqfs-support-bundle';
import { nextArqfsLifecycleCorrelationId, type ArqfsLifecycleEvent } from './arqfs-lifecycle-event';

const capabilities = {
  usedVfs: 'opfs-sahpool',
  formatMajor: 1,
  formatSchema: 2,
  nativeSqliteAvailable: false,
  runtime: 'Chromium 141',
};

const healthyHealth = { integrityOk: true, interruptedWrite: false, missingRequiredEntryCount: 0 };

describe('buildArqfsSupportBundle', () => {
  it('includes the supplied capability, health and event data verbatim', () => {
    const event: ArqfsLifecycleEvent = {
      correlationId: nextArqfsLifecycleCorrelationId(),
      timestampUnixMs: 1000,
      kind: 'integrity-check',
      ok: true,
      quickCheckIssueCount: 0,
      foreignKeyViolationCount: 0,
      durationMs: 2,
    };

    const bundle = buildArqfsSupportBundle({
      capabilities,
      health: healthyHealth,
      events: [event],
      generatedAtUnixMs: 5000,
    });

    expect(bundle.generatedAtUnixMs).toBe(5000);
    expect(bundle.capabilities).toEqual(capabilities);
    expect(bundle.health).toEqual(healthyHealth);
    expect(bundle.events).toEqual([event]);
  });

  it('the preview always names the same excluded categories, regardless of what health/events are supplied', () => {
    const bundle = buildArqfsSupportBundle({ capabilities, health: healthyHealth, events: [] });
    expect(bundle.preview.excludes).toEqual([
      'project file bytes or geometry',
      'file names or filesystem paths',
      'authentication tokens or credentials',
      'project, client or address names',
    ]);
  });

  it('the preview event count matches the actual event array length', () => {
    const events: readonly ArqfsLifecycleEvent[] = Array.from({ length: 3 }, () => ({
      correlationId: nextArqfsLifecycleCorrelationId(),
      timestampUnixMs: 1,
      kind: 'storage-quota',
      status: 'ok',
    }));
    const bundle = buildArqfsSupportBundle({ capabilities, health: healthyHealth, events });
    expect(bundle.preview.eventCount).toBe(3);
    expect(bundle.preview.includes.some((line) => line.includes('3 recent lifecycle events'))).toBe(
      true,
    );
  });

  it('singular event count reads naturally, not "1 events"', () => {
    const events: readonly ArqfsLifecycleEvent[] = [
      {
        correlationId: nextArqfsLifecycleCorrelationId(),
        timestampUnixMs: 1,
        kind: 'storage-quota',
        status: 'ok',
      },
    ];
    const bundle = buildArqfsSupportBundle({ capabilities, health: healthyHealth, events });
    expect(
      bundle.preview.includes.some((line) => line.includes('1 recent lifecycle event (')),
    ).toBe(true);
  });

  it('defaults generatedAtUnixMs to now when not supplied', () => {
    const before = Date.now();
    const bundle = buildArqfsSupportBundle({ capabilities, health: healthyHealth, events: [] });
    const after = Date.now();
    expect(bundle.generatedAtUnixMs).toBeGreaterThanOrEqual(before);
    expect(bundle.generatedAtUnixMs).toBeLessThanOrEqual(after);
  });

  it('reports unknown health honestly (null) rather than a fabricated ok/not-ok', () => {
    const bundle = buildArqfsSupportBundle({
      capabilities,
      health: { integrityOk: null, interruptedWrite: null, missingRequiredEntryCount: null },
      events: [],
    });
    expect(bundle.health.integrityOk).toBeNull();
  });
});
