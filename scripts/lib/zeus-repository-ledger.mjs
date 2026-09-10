import { verificationCommandsToChecks } from './zeus-repository-evidence.mjs';

const CHECK_ALIASES = {
  'format:check': ['format:check', 'format', 'prettier'],
  lint: ['lint', 'eslint'],
  typecheck: ['typecheck', 'tsc', 'types', 'tsc --noemit'],
  test: ['test', 'tests', 'vitest', 'suite'],
  build: ['build'],
  'zeus:validate': ['zeus:validate', 'validate'],
  'zeus:drift': ['zeus:drift', 'drift'],
};

const unique = (values) => [...new Set(values.filter(Boolean))].sort();

export function graphProvenance(graph) {
  const edges = [...(graph?.context?.edges ?? []), ...(graph?.impact?.edges ?? [])];
  const provenance = edges.map((edge) => edge.provenance).filter(Boolean);
  if ((graph?.seeds?.resolved?.length ?? 0) > 0) provenance.push('deterministic');
  return unique(provenance);
}

export function graphLedgerState(graph, tier = 'standard') {
  const requested = [...(graph?.seeds?.requested ?? [])];
  const resolved = [...(graph?.seeds?.resolved ?? [])];
  const unresolved = [...(graph?.seeds?.unresolved ?? [])];
  const ambiguous = { ...(graph?.seeds?.ambiguous ?? {}) };
  const contextTruncated = Boolean(graph?.context?.truncated);
  const impactTruncated = Boolean(graph?.impact?.truncated);
  const uncertainty = Boolean(graph?.uncertainty);
  const fresh = Boolean(graph?.fresh);
  const completeness =
    !fresh || uncertainty || unresolved.length || Object.keys(ambiguous).length
      ? 'unresolved'
      : contextTruncated || impactTruncated
        ? 'truncated'
        : 'complete';

  return {
    protocol: 'zeus-repository-ledger/v1',
    tier,
    fresh,
    uncertainty,
    reason: graph?.reason ?? null,
    fingerprint: graph?.fingerprint ?? null,
    sourceRevision: graph?.source_revision ?? graph?.source?.source_revision ?? null,
    branch: graph?.branch ?? graph?.source?.branch ?? null,
    query: { kind: 'seed', seeds: requested },
    resolution: { resolved, unresolved, ambiguous },
    completeness,
    truncation: { context: contextTruncated, impact: impactTruncated },
    provenance: graphProvenance(graph),
    verification: {
      level: graph?.verification?.level ?? 'unknown',
      uncertain: Boolean(graph?.verification?.uncertain),
      domains: [...(graph?.verification?.domains ?? [])],
      commands: [...(graph?.verification?.commands ?? [])],
    },
  };
}

export function graphStateProblems(
  state,
  allowedProvenance = [],
  { protectedOnly = false, recordedFingerprint = null, requireHardProvenance = false } = {},
) {
  const protectedGraph = state?.verification?.level === 'protected';
  if (protectedOnly && !protectedGraph) return [];

  const problems = [];
  if (!state?.fresh) {
    problems.push(`repository graph is stale or missing (${state?.reason ?? 'unknown'})`);
  }
  if (recordedFingerprint && state?.fingerprint !== recordedFingerprint) {
    problems.push('repository graph fingerprint changed since the gate/evidence record');
  }

  const unresolved = state?.resolution?.unresolved ?? [];
  const ambiguous = Object.keys(state?.resolution?.ambiguous ?? {});
  if (unresolved.length) problems.push(`repository graph has unresolved seed(s): ${unresolved.join(', ')}`);
  if (ambiguous.length) problems.push(`repository graph has ambiguous seed(s): ${ambiguous.join(', ')}`);
  if (state?.completeness === 'truncated') {
    problems.push('repository graph evidence is truncated and cannot prove a verified claim or protected gate');
  }

  const allowed = new Set(allowedProvenance);
  const provenance = state?.provenance ?? [];
  const mustUseHardProvenance = protectedGraph || requireHardProvenance;
  const disallowed = provenance.filter((value) => !allowed.has(value));
  if (mustUseHardProvenance && disallowed.length) {
    problems.push(`repository graph uses non-hard-gate provenance: ${unique(disallowed).join(', ')}`);
  }
  if (mustUseHardProvenance && provenance.length === 0) {
    problems.push('repository graph has no hard-gate provenance for verified evidence');
  }

  return unique(problems);
}

export function requiredGraphChecks(state) {
  return verificationCommandsToChecks(state?.verification?.commands ?? []);
}

function gateMatchesCheck(gate, check) {
  const value = String(gate).trim().toLowerCase();
  const aliases = CHECK_ALIASES[check] ?? [check];
  return aliases.includes(value);
}

export function missingGraphChecks(gates, checks, signature, graphFingerprint = null) {
  return checks.filter(
    (check) =>
      !(gates ?? []).some(
        (gate) =>
          gate.outcome === 'pass' &&
          gate.signature === signature &&
          (!graphFingerprint || gate.repositoryGraph?.fingerprint === graphFingerprint) &&
          gateMatchesCheck(gate.gate, check),
      ),
  );
}
