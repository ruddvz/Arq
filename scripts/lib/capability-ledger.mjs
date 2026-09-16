import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function evidenceForPath(repoRoot, relativePath, kind) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return { kind, path: relativePath, exists: false, sha256: null };
  }
  return {
    kind,
    path: relativePath,
    exists: true,
    sha256: sha256(readFileSync(absolutePath)),
  };
}

function extractToolReachabilityBlock(source) {
  const marker = 'const TOOL_REACHABILITY';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error('command authority has no TOOL_REACHABILITY block');
  const start = source.indexOf('= {', markerIndex);
  const endMarker = '\n};\n\nfunction toolDescriptor';
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('could not bound TOOL_REACHABILITY block');
  return source.slice(start + 3, end);
}

function quotedStrings(block) {
  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

export function parseCommandToolFacts(source, toolRegistry) {
  const backingMatch = source.match(
    /export const TOOLS_WITH_REPOSITORY_BACKING: readonly string\[\] = \[([\s\S]*?)\];/,
  );
  if (backingMatch === null) throw new Error('command authority has no backing list');
  const backing = new Set(quotedStrings(backingMatch[1]));
  const reachabilityBlock = extractToolReachabilityBlock(source);
  const groups = new Map(toolRegistry.tools.map((tool) => [tool.id, tool.group]));
  const semanticMatch = source.match(
    /const semanticOperationId = tool\.id === '([^']+)' \? '([^']+)' : null;/,
  );
  const semanticById = new Map(semanticMatch ? [[semanticMatch[1], semanticMatch[2]]] : []);
  const facts = new Map();

  for (const tool of toolRegistry.tools) {
    const escaped = tool.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const entryPattern = new RegExp(
      `(?:^|\\n)\\s*(?:'${escaped}'|${escaped}):\\s*\\{([\\s\\S]*?)\\n\\s*\\},`,
    );
    const entry = reachabilityBlock.match(entryPattern);
    if (entry === null) continue;
    const state = entry[1].match(/state:\s*'([^']+)'/)?.[1] ?? null;
    const reason =
      entry[1].match(/reason:\s*'([^']+)'/)?.[1] ??
      (entry[1].match(/reason:\s*null/) ? null : 'Unparsed disabled reason');
    const semanticOperationRef = semanticById.get(tool.id) ?? null;
    const group = groups.get(tool.id) ?? null;
    const mutationType =
      semanticOperationRef !== null || group === 'Build' || group === 'Modify'
        ? 'semantic-project'
        : 'view-session';
    facts.set(tool.id, {
      commandId: tool.id,
      reachability: state,
      unavailableReason: reason,
      libraryBacking: backing.has(tool.id),
      group,
      mutationType,
      semanticOperationRef,
    });
  }
  return facts;
}

function allExist(items) {
  return items.length > 0 && items.every((item) => item.exists);
}

function evidenceStatus(items, required = false) {
  if (items.length === 0) return required ? 'required-missing' : 'not-declared';
  if (items.every((item) => item.exists)) return 'present';
  if (items.some((item) => item.exists)) return 'partial';
  return required ? 'required-missing' : 'missing';
}

function libraryBackingState(sourceEvidence, commandFact) {
  if (commandFact?.libraryBacking === true) return 'present';
  if (sourceEvidence.length === 0) return 'absent';
  if (sourceEvidence.every((item) => item.exists)) return 'present';
  if (sourceEvidence.some((item) => item.exists)) return 'unknown';
  return 'absent';
}

function mergeBlockers(definition, providers) {
  return definition.mergeRequirements
    .map((id) => ({ id, provider: providers[id] }))
    .filter(({ provider }) => provider === undefined || provider.merged !== true)
    .map(({ id, provider }) =>
      provider === undefined
        ? `Required provider ${id} is not declared`
        : `Provider ${id} is not merged (PR #${provider.pr ?? 'unknown'})`,
    );
}

function deriveMaturity({
  definition,
  commandFact,
  sourceEvidence,
  testEvidence,
  executionEvidence,
  humanEvidence,
  blockers,
}) {
  if (definition.humanEvidenceRequired && !allExist(humanEvidence)) {
    return 'human_evidence_required';
  }
  if (commandFact !== null) {
    if (commandFact.reachability !== 'user-reachable') {
      return commandFact.libraryBacking ? 'library_only' : 'planned';
    }
    if (blockers.length > 0) return 'partial';
    return allExist(testEvidence) && allExist(executionEvidence)
      ? 'verified_current'
      : 'partial';
  }
  if (!allExist(sourceEvidence)) return 'planned';
  if (definition.productSurface === null) return 'library_only';
  if (blockers.length > 0) return 'partial';
  if (!allExist(testEvidence) || !allExist(executionEvidence)) return 'partial';
  return 'verified_current';
}

function deriveAvailability(maturity, commandFact, blockers) {
  if (commandFact !== null && commandFact.reachability !== 'user-reachable') {
    return 'unavailable';
  }
  if (blockers.length > 0 || maturity === 'human_evidence_required') return 'blocked';
  if (maturity === 'verified_current') return 'available';
  if (maturity === 'partial') return 'blocked';
  return 'unavailable';
}

function deriveExecutionPath(maturity, commandFact) {
  if (commandFact !== null && commandFact.reachability !== 'user-reachable') return 'absent';
  if (maturity === 'verified_current') return 'proven';
  if (maturity === 'partial' || maturity === 'human_evidence_required') return 'unproven';
  return 'absent';
}

function deriveReadOnlyStatus(commandFact) {
  if (commandFact === null) return 'unknown';
  return commandFact.mutationType === 'semantic-project' ? 'blocked' : 'compatible';
}

function derivePersistenceSupport(definition, commandFact, blockers) {
  if (commandFact?.mutationType === 'view-session') return 'not-required';
  if (definition.category === 'Project lifecycle' && blockers.length === 0) return 'supported';
  if (
    commandFact?.mutationType === 'semantic-project' ||
    definition.category === 'Project lifecycle'
  ) {
    return 'unknown';
  }
  return 'not-required';
}

function evidenceFingerprint(definition, provider, evidence, commandFact) {
  const payload = {
    capabilityId: definition.capabilityId,
    providerRevision: provider?.revision ?? null,
    commandFact,
    evidence,
  };
  return sha256(JSON.stringify(payload));
}

export function buildCapabilityLedger({
  repoRoot,
  definitions,
  commandAuthoritySource,
  toolRegistry,
}) {
  const commandFacts = parseCommandToolFacts(commandAuthoritySource, toolRegistry);
  const records = definitions.capabilities.map((definition) => {
    const sourceEvidence = definition.sourcePaths.map((p) =>
      evidenceForPath(repoRoot, p, 'source'),
    );
    const testEvidence = definition.testPaths.map((p) => evidenceForPath(repoRoot, p, 'test'));
    const executionEvidence = definition.executionEvidencePaths.map((p) =>
      evidenceForPath(repoRoot, p, 'execution'),
    );
    const humanEvidence = (definition.humanEvidencePaths ?? []).map((p) =>
      evidenceForPath(repoRoot, p, 'human'),
    );
    const accessibilityEvidence = (definition.accessibilityEvidencePaths ?? []).map((p) =>
      evidenceForPath(repoRoot, p, 'accessibility'),
    );
    const performanceEvidence = (definition.performanceEvidencePaths ?? []).map((p) =>
      evidenceForPath(repoRoot, p, 'performance'),
    );
    const commandFact = definition.commandId
      ? (commandFacts.get(definition.commandId) ?? null)
      : null;
    const blockers = mergeBlockers(definition, definitions.providers);
    if (commandFact?.unavailableReason) blockers.push(commandFact.unavailableReason);
    if (definition.humanEvidenceRequired && !allExist(humanEvidence)) {
      blockers.push('Required approved human evidence is missing');
    }
    if (definition.accessibilityEvidenceRequired && !allExist(accessibilityEvidence)) {
      blockers.push('Required accessibility evidence is missing');
    }
    if (definition.performanceEvidenceRequired && !allExist(performanceEvidence)) {
      blockers.push('Required performance evidence is missing');
    }
    const maturity = deriveMaturity({
      definition,
      commandFact,
      sourceEvidence,
      testEvidence,
      executionEvidence,
      humanEvidence,
      blockers,
    });
    const provider = definition.provider ? definitions.providers[definition.provider] : null;
    const evidence = [
      ...sourceEvidence,
      ...testEvidence,
      ...executionEvidence,
      ...humanEvidence,
      ...accessibilityEvidence,
      ...performanceEvidence,
    ];

    return {
      capabilityId: definition.capabilityId,
      feature: definition.feature,
      category: definition.category,
      programmePhase: definition.programmePhase,
      userJourneys: definition.userJourneys,
      designed: true,
      libraryBacking: libraryBackingState(sourceEvidence, commandFact),
      productReachabilityState: commandFact?.reachability ?? null,
      productExecutionPath: deriveExecutionPath(maturity, commandFact),
      availability: deriveAvailability(maturity, commandFact, blockers),
      unavailableReason:
        commandFact?.unavailableReason ?? (blockers.length > 0 ? blockers[0] : null),
      productSurface: definition.productSurface,
      platforms: definition.platforms,
      readOnlyStatus: deriveReadOnlyStatus(commandFact),
      mutationType: commandFact?.mutationType ?? 'unknown',
      semanticOperationRef: commandFact?.semanticOperationRef ?? null,
      persistenceSupport: derivePersistenceSupport(definition, commandFact, blockers),
      humanEvidenceStatus: evidenceStatus(humanEvidence, definition.humanEvidenceRequired),
      accessibilityEvidenceStatus: evidenceStatus(
        accessibilityEvidence,
        definition.accessibilityEvidenceRequired,
      ),
      performanceEvidenceStatus: evidenceStatus(
        performanceEvidence,
        definition.performanceEvidenceRequired,
      ),
      maturity,
      maturityWeight: definitions.maturityWeights[maturity],
      blockers,
      provider: definition.provider,
      providerRevision: provider?.revision ?? null,
      providerMerged: provider?.merged ?? null,
      evidence,
      evidenceFingerprint: evidenceFingerprint(definition, provider, evidence, commandFact),
      publicClaimEligible: definition.publicClaimEligible && maturity === 'verified_current',
      releaseGates: definition.releaseGates,
    };
  });

  const counts = Object.fromEntries(
    Object.keys(definitions.maturityWeights).map((state) => [
      state,
      records.filter((record) => record.maturity === state).length,
    ]),
  );
  const score =
    records.length === 0
      ? 0
      : records.reduce((sum, record) => sum + record.maturityWeight, 0) / records.length;

  return {
    schemaVersion: definitions.schemaVersion,
    generatedFrom: 'docs/product/capabilities/ARQ-CAPABILITY-DEFINITIONS.json',
    integrationAuthority: definitions.integrationAuthority,
    providers: definitions.providers,
    maturityWeights: definitions.maturityWeights,
    summary: {
      total: records.length,
      counts,
      weightedMaturityScore: Number(score.toFixed(4)),
    },
    capabilities: records,
  };
}

export function renderCapabilityDashboard(ledger) {
  const rows = ledger.capabilities
    .map(
      (record) =>
        `| \`${record.capabilityId}\` | ${record.feature} | ${record.productSurface ?? 'library'} | ${record.libraryBacking} | ${record.productReachabilityState ?? 'n/a'} | ${record.productExecutionPath} | ${record.availability} | ${record.humanEvidenceStatus} | ${record.accessibilityEvidenceStatus} | ${record.performanceEvidenceStatus} | ${record.maturity} | ${record.blockers[0] ?? '—'} |`,
    )
    .join('\n');
  const providerRows = Object.entries(ledger.providers)
    .map(
      ([id, provider]) =>
        `| \`${id}\` | ${provider.kind} | ${provider.pr ? `#${provider.pr}` : '—'} | ${provider.merged ? 'merged' : 'unmerged'} | \`${provider.revision}\` |`,
    )
    .join('\n');

  return `# ARQ product capability dashboard

_Generated from \`${ledger.generatedFrom}\`. Do not edit this file by hand._

Integration authority: \`${ledger.integrationAuthority.branch} @ ${ledger.integrationAuthority.revision}\`

The ledger is intentionally conservative. Repository backing, tests, or an open PR do not make a feature product-reachable. Unmerged providers cap dependent capabilities below \`verified_current\`. Human evidence can promote a capability only when an explicitly declared approved evidence receipt is present alongside the required source, test and execution evidence. Required accessibility or performance evidence also blocks promotion until its declared evidence is present.

## Summary

- Capabilities: **${ledger.summary.total}**
- Weighted maturity score: **${ledger.summary.weightedMaturityScore}**
${Object.entries(ledger.summary.counts)
  .map(([state, count]) => `- ${state}: **${count}**`)
  .join('\n')}

## Provider state

| Provider | Kind | PR | State | Revision |
|---|---|---:|---|---|
${providerRows}

## Capability ledger

| Capability | Feature | Surface | Library backing | Reachability | Product execution | Availability | Human evidence | Accessibility | Performance | Maturity | Primary blocker |
|---|---|---|---|---|---|---|---|---|---|---|---|
${rows}
`;
}

export function assertDefinitionsAreProjectionOnly(definitions) {
  const forbidden = [
    'maturity',
    'availability',
    'productReachabilityState',
    'productExecutionPath',
    'libraryBacking',
    'humanEvidenceStatus',
    'accessibilityEvidenceStatus',
    'performanceEvidenceStatus',
  ];
  for (const capability of definitions.capabilities) {
    for (const field of forbidden) {
      if (Object.prototype.hasOwnProperty.call(capability, field)) {
        throw new Error(`${capability.capabilityId} authors derived field ${field}`);
      }
    }
  }
}
