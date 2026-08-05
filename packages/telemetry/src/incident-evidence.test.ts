import { describe, expect, it } from 'vitest';
import { createReceiptLog } from './diagnostic-receipt';
import {
  INCIDENT_STORE_REFUSALS,
  REQUIRED_ARTIFACTS,
  createIncidentEvidenceStore,
  describeIncidentCapture,
  evidenceCapturedFor,
  preserveIncidentEvidence,
  type PreservedArtifactRef,
} from './incident-evidence';

function artifact(
  role: PreservedArtifactRef['role'],
  artifactId = `artifact-${role}`,
): PreservedArtifactRef {
  return { artifactId, role, byteLength: 1024, sha256: 'a'.repeat(64) };
}

function receipts() {
  const log = createReceiptLog();
  log.record({ kind: 'project-opened', atUnixMs: 1, evidence: 'observed' });
  log.record({ kind: 'integrity-failed' as never, atUnixMs: 2, evidence: 'observed' });
  return log.all();
}

describe('preserveIncidentEvidence', () => {
  it('records a complete capture', () => {
    const evidence = preserveIncidentEvidence({
      incidentId: 'incident-1',
      kind: 'open-failed',
      detectedAtUnixMs: 1000,
      artifacts: [artifact('source-file')],
      receipts: receipts(),
    });

    expect(evidence.complete).toBe(true);
    expect(evidence.missingRoles).toEqual([]);
  });

  it('records a partial capture rather than refusing it', () => {
    // Half the evidence is worth considerably more than none, as long as the
    // record says which half.
    const evidence = preserveIncidentEvidence({
      incidentId: 'incident-2',
      kind: 'interrupted-write',
      detectedAtUnixMs: 1000,
      artifacts: [artifact('working-copy')],
      receipts: [],
    });

    expect(evidence.complete).toBe(false);
    expect(evidence.missingRoles).toEqual(['sidecar']);
  });

  it('needs the sidecars for an interrupted write, not just the main file', () => {
    // A preserved main file without its WAL says nothing about what
    // interrupted.
    expect(REQUIRED_ARTIFACTS['interrupted-write']).toContain('sidecar');
  });

  it('copies the arrays it is given, since evidence that changes is not evidence', () => {
    const artifacts = [artifact('source-file')];
    const evidence = preserveIncidentEvidence({
      incidentId: 'incident-3',
      kind: 'open-failed',
      detectedAtUnixMs: 1000,
      artifacts,
      receipts: [],
    });

    artifacts.push(artifact('journal'));

    expect(evidence.artifacts).toHaveLength(1);
  });

  it('holds references, never bytes', () => {
    // This module must not become a place project content lives.
    const evidence = preserveIncidentEvidence({
      incidentId: 'incident-4',
      kind: 'open-failed',
      detectedAtUnixMs: 1000,
      artifacts: [artifact('source-file')],
      receipts: [],
    });

    expect(evidence.artifacts[0]).not.toHaveProperty('bytes');
    expect(evidence.artifacts[0]?.sha256).toHaveLength(64);
  });

  it('records an incident where nothing could be preserved', () => {
    const evidence = preserveIncidentEvidence({
      incidentId: 'incident-5',
      kind: 'open-failed',
      detectedAtUnixMs: 1000,
      artifacts: [],
      receipts: [],
    });

    expect(evidence.complete).toBe(false);
    expect(evidence.missingRoles).toEqual(['source-file']);
  });
});

describe('createIncidentEvidenceStore', () => {
  function capture(incidentId: string, atUnixMs = 1000) {
    return preserveIncidentEvidence({
      incidentId,
      kind: 'open-failed',
      detectedAtUnixMs: atUnixMs,
      artifacts: [artifact('source-file')],
      receipts: [],
    });
  }

  it('stores a capture', () => {
    const store = createIncidentEvidenceStore();

    expect(store.record(capture('incident-1')).stored).toBe(true);
    expect(store.get('incident-1')?.incidentId).toBe('incident-1');
  });

  it('refuses to overwrite an incident it already holds', () => {
    // A retry overwriting the capture that mattered leaves something that
    // looks like evidence and is not.
    const store = createIncidentEvidenceStore();
    store.record(capture('incident-1', 1000));

    const second = store.record(capture('incident-1', 2000));

    expect(second.stored).toBe(false);
    expect(second.reason).toBe(INCIDENT_STORE_REFUSALS.alreadyRecorded);
    expect(store.get('incident-1')?.detectedAtUnixMs).toBe(1000);
  });

  it('lists incidents oldest first', () => {
    const store = createIncidentEvidenceStore();
    store.record(capture('later', 2000));
    store.record(capture('earlier', 1000));

    expect(store.all().map((evidence) => evidence.incidentId)).toEqual(['earlier', 'later']);
  });
});

describe('evidenceCapturedFor', () => {
  it('issues a token only for evidence actually in the store', () => {
    // A caller cannot mint permission by asserting it preserved something.
    const store = createIncidentEvidenceStore();

    expect(evidenceCapturedFor(store, 'never-captured')).toBeNull();
  });

  it('issues a token for a stored capture', () => {
    const store = createIncidentEvidenceStore();
    store.record(
      preserveIncidentEvidence({
        incidentId: 'incident-1',
        kind: 'open-failed',
        detectedAtUnixMs: 1000,
        artifacts: [artifact('source-file')],
        receipts: [],
      }),
    );

    expect(evidenceCapturedFor(store, 'incident-1')).toEqual({
      incidentId: 'incident-1',
      complete: true,
    });
  });

  it('still authorises recovery on a partial capture, carrying the gap with it', () => {
    // The user's work matters more than a perfect record, and the gap travels
    // with the permission rather than being forgotten.
    const store = createIncidentEvidenceStore();
    store.record(
      preserveIncidentEvidence({
        incidentId: 'incident-2',
        kind: 'interrupted-write',
        detectedAtUnixMs: 1000,
        artifacts: [artifact('working-copy')],
        receipts: [],
      }),
    );

    expect(evidenceCapturedFor(store, 'incident-2')).toEqual({
      incidentId: 'incident-2',
      complete: false,
    });
  });
});

describe('describeIncidentCapture', () => {
  it('says nothing was sent anywhere', () => {
    // A user whose file failed to open has not thereby agreed to send it
    // anywhere.
    const evidence = preserveIncidentEvidence({
      incidentId: 'incident-1',
      kind: 'open-failed',
      detectedAtUnixMs: 1000,
      artifacts: [artifact('source-file')],
      receipts: [],
    });

    expect(describeIncidentCapture(evidence)).toContain('Nothing was sent anywhere.');
  });

  it('names what could not be preserved rather than hiding the gap', () => {
    const evidence = preserveIncidentEvidence({
      incidentId: 'incident-2',
      kind: 'interrupted-write',
      detectedAtUnixMs: 1000,
      artifacts: [artifact('working-copy')],
      receipts: [],
    });

    const sentence = describeIncidentCapture(evidence);
    expect(sentence).toContain('partial');
    expect(sentence).toContain('sidecar');
  });
});
