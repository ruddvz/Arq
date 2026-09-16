import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertDefinitionsAreProjectionOnly,
  buildCapabilityLedger,
  parseCommandToolFacts,
} from './lib/capability-ledger.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const definitions = JSON.parse(
  readFileSync(
    path.join(repoRoot, 'docs/product/capabilities/ARQ-CAPABILITY-DEFINITIONS.json'),
    'utf8',
  ),
);
const commandAuthoritySource = readFileSync(
  path.join(repoRoot, definitions.providers['command-authority'].source),
  'utf8',
);
const toolRegistry = JSON.parse(
  readFileSync(
    path.join(repoRoot, 'packages/workspace/src/registry/workspace-tool-registry.json'),
    'utf8',
  ),
);

function ledger() {
  return buildCapabilityLedger({ repoRoot, definitions, commandAuthoritySource, toolRegistry });
}

function record(capabilityId: string) {
  const found = ledger().capabilities.find(
    (item: { capabilityId: string }) => item.capabilityId === capabilityId,
  );
  expect(found, `missing capability ${capabilityId}`).toBeDefined();
  return found;
}

function buildMini(repoRoot: string, capability: Record<string, unknown>) {
  return buildCapabilityLedger({
    repoRoot,
    definitions: {
      ...definitions,
      capabilities: [capability],
    },
    commandAuthoritySource,
    toolRegistry,
  }).capabilities[0];
}

describe('ARQ capability ledger', () => {
  it('keeps the seed projection-only rather than authoring derived product truth', () => {
    expect(() => assertDefinitionsAreProjectionOnly(definitions)).not.toThrow();
    for (const capability of definitions.capabilities) {
      expect(capability).not.toHaveProperty('maturity');
      expect(capability).not.toHaveProperty('availability');
      expect(capability).not.toHaveProperty('productReachabilityState');
      expect(capability).not.toHaveProperty('productExecutionPath');
      expect(capability).not.toHaveProperty('libraryBacking');
      expect(capability).not.toHaveProperty('humanEvidenceStatus');
      expect(capability).not.toHaveProperty('accessibilityEvidenceStatus');
      expect(capability).not.toHaveProperty('performanceEvidenceStatus');
    }
  });

  it('consumes #420 tool reachability and backing as separate facts', () => {
    const facts = parseCommandToolFacts(commandAuthoritySource, toolRegistry);
    expect(facts.get('wall')).toMatchObject({
      reachability: 'user-reachable',
      libraryBacking: true,
      semanticOperationRef: 'add-walls',
      mutationType: 'semantic-project',
    });
    expect(facts.get('door')).toMatchObject({
      reachability: 'registered-but-not-wired',
      libraryBacking: true,
    });
  });

  it('does not promote an unmerged reachable command to current product truth', () => {
    expect(record('core.wall')).toMatchObject({
      availability: 'blocked',
      maturity: 'partial',
      productReachabilityState: 'user-reachable',
      productExecutionPath: 'unproven',
      semanticOperationRef: 'add-walls',
      providerMerged: false,
      publicClaimEligible: false,
    });
  });

  it('keeps repository-backed but unwired tools unavailable without erasing reachability state', () => {
    for (const id of [
      'audit.tool.door',
      'audit.tool.window',
      'audit.tool.room-boundary',
      'audit.tool.window-select',
      'audit.tool.crossing-select',
      'audit.tool.selection-filter',
      'audit.tool.zoom',
    ]) {
      const tool = record(id);
      expect(tool.libraryBacking).toBe('present');
      expect(tool.productReachabilityState).toBe('registered-but-not-wired');
      expect(tool.productExecutionPath).toBe('absent');
      expect(tool.availability).toBe('unavailable');
      expect(tool.maturity).toBe('library_only');
      expect(tool.publicClaimEligible).toBe(false);
    }
  });

  it('distinguishes planned, library-only and human-evidence states', () => {
    expect(record('core.underlay').maturity).toBe('planned');
    expect(record('core.units').maturity).toBe('library_only');
    expect(record('core.browser-device')).toMatchObject({
      maturity: 'human_evidence_required',
      humanEvidenceStatus: 'required-missing',
      availability: 'blocked',
      publicClaimEligible: false,
    });
  });

  it('promotes approved human evidence only when product evidence is complete', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'arq-capability-human-evidence-'));
    try {
      writeFileSync(path.join(root, 'source.txt'), 'source');
      writeFileSync(path.join(root, 'test.txt'), 'test');
      writeFileSync(path.join(root, 'browser.json'), '{"passed":true}');
      const capability = {
        capabilityId: 'test.browser-evidence',
        feature: 'Browser evidence proof',
        category: 'Test',
        productSurface: 'Test surface',
        sourcePaths: ['source.txt'],
        testPaths: ['test.txt'],
        executionEvidencePaths: ['browser.json'],
        humanEvidencePaths: ['human-review.txt'],
        platforms: ['test'],
        userJourneys: [],
        programmePhase: 'Test',
        provider: null,
        commandId: null,
        mergeRequirements: [],
        humanEvidenceRequired: true,
        publicClaimEligible: true,
        releaseGates: [],
      };

      expect(buildMini(root, capability)).toMatchObject({
        maturity: 'human_evidence_required',
        humanEvidenceStatus: 'required-missing',
        availability: 'blocked',
        publicClaimEligible: false,
      });

      writeFileSync(path.join(root, 'human-review.txt'), 'approved');
      expect(buildMini(root, capability)).toMatchObject({
        maturity: 'verified_current',
        humanEvidenceStatus: 'present',
        productExecutionPath: 'proven',
        availability: 'available',
        publicClaimEligible: true,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not let a human receipt replace missing product evidence', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'arq-capability-human-only-'));
    try {
      writeFileSync(path.join(root, 'human-review.txt'), 'approved');
      const capability = {
        capabilityId: 'test.human-only',
        feature: 'Human-only proof',
        category: 'Test',
        productSurface: 'Test surface',
        sourcePaths: ['missing-source.txt'],
        testPaths: ['missing-test.txt'],
        executionEvidencePaths: ['missing-browser.json'],
        humanEvidencePaths: ['human-review.txt'],
        platforms: ['test'],
        userJourneys: [],
        programmePhase: 'Test',
        provider: null,
        commandId: null,
        mergeRequirements: [],
        humanEvidenceRequired: true,
        publicClaimEligible: true,
        releaseGates: [],
      };

      expect(buildMini(root, capability)).toMatchObject({
        humanEvidenceStatus: 'present',
        maturity: 'planned',
        productExecutionPath: 'absent',
        availability: 'unavailable',
        publicClaimEligible: false,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks missing mandatory accessibility or performance evidence independently', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'arq-capability-required-evidence-'));
    try {
      for (const [file, value] of [
        ['source.txt', 'source'],
        ['test.txt', 'test'],
        ['execution.json', '{"passed":true}'],
        ['accessibility.json', '{"passed":true}'],
      ]) {
        writeFileSync(path.join(root, file), value);
      }
      const capability = {
        capabilityId: 'test.required-evidence',
        feature: 'Required evidence proof',
        category: 'Test',
        productSurface: 'Test surface',
        sourcePaths: ['source.txt'],
        testPaths: ['test.txt'],
        executionEvidencePaths: ['execution.json'],
        accessibilityEvidencePaths: ['accessibility.json'],
        accessibilityEvidenceRequired: true,
        performanceEvidencePaths: ['performance.json'],
        performanceEvidenceRequired: true,
        platforms: ['test'],
        userJourneys: [],
        programmePhase: 'Test',
        provider: null,
        commandId: null,
        mergeRequirements: [],
        humanEvidenceRequired: false,
        publicClaimEligible: false,
        releaseGates: [],
      };

      const blocked = buildMini(root, capability);
      expect(blocked).toMatchObject({
        accessibilityEvidenceStatus: 'present',
        performanceEvidenceStatus: 'required-missing',
        maturity: 'partial',
        availability: 'blocked',
      });
      expect(blocked.blockers).toContain('Required performance evidence is missing');

      writeFileSync(path.join(root, 'performance.json'), '{"passed":true}');
      expect(buildMini(root, capability)).toMatchObject({
        accessibilityEvidenceStatus: 'present',
        performanceEvidenceStatus: 'present',
        maturity: 'verified_current',
        availability: 'available',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('seeds every required Core 1.0 capability family', () => {
    const required = [
      'core.project.create',
      'core.units',
      'core.levels',
      'core.underlay',
      'core.wall',
      'core.openings',
      'core.rooms',
      'core.dimensions',
      'core.notes',
      'core.plan',
      'core.3d',
      'core.browser-inspector',
      'core.arq.open',
      'core.arq.edit',
      'core.arq.publish',
      'core.arq.reopen',
      'core.arq.recover',
      'core.sheet.one',
      'core.pdf.vector',
      'core.browser-device',
    ];
    const ids = new Set(
      ledger().capabilities.map((item: { capabilityId: string }) => item.capabilityId),
    );
    for (const id of required) expect(ids.has(id), id).toBe(true);
  });

  it('makes maturity weights explicit and reproducible', () => {
    const output = ledger();
    for (const capability of output.capabilities) {
      expect(capability.maturityWeight).toBe(output.maturityWeights[capability.maturity]);
    }
    const expected =
      output.capabilities.reduce(
        (sum: number, capability: { maturityWeight: number }) => sum + capability.maturityWeight,
        0,
      ) / output.capabilities.length;
    expect(output.summary.weightedMaturityScore).toBe(Number(expected.toFixed(4)));
  });

  it('fingerprints source evidence so stale verified claims can be detected', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'arq-capability-ledger-'));
    try {
      writeFileSync(path.join(root, 'source.txt'), 'version one');
      writeFileSync(path.join(root, 'test.txt'), 'test evidence');
      const mini = {
        ...definitions,
        providers: definitions.providers,
        capabilities: [
          {
            capabilityId: 'test.fingerprint',
            feature: 'Fingerprint proof',
            category: 'Test',
            productSurface: 'Test surface',
            sourcePaths: ['source.txt'],
            testPaths: ['test.txt'],
            executionEvidencePaths: ['test.txt'],
            platforms: ['test'],
            userJourneys: [],
            programmePhase: 'Test',
            provider: null,
            commandId: null,
            mergeRequirements: [],
            humanEvidenceRequired: false,
            publicClaimEligible: false,
            releaseGates: [],
          },
        ],
      };
      const first = buildCapabilityLedger({
        repoRoot: root,
        definitions: mini,
        commandAuthoritySource,
        toolRegistry,
      }).capabilities[0].evidenceFingerprint;
      writeFileSync(path.join(root, 'source.txt'), 'version two');
      const second = buildCapabilityLedger({
        repoRoot: root,
        definitions: mini,
        commandAuthoritySource,
        toolRegistry,
      }).capabilities[0].evidenceFingerprint;
      expect(second).not.toBe(first);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is deterministic for an unchanged repository state', () => {
    expect(ledger()).toEqual(ledger());
  });
});
