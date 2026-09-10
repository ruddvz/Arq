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
  const complete =
    fresh &&
    !uncertainty &&
    unresolved.length === 0 &&
    Object.keys(ambiguous).length === 0 &&
    !contextTruncated &&
    !impactTruncated;

  return {
    protocol: 'zeus-repository-ledger/v1',
    tier,
    fresh,
    uncertainty,
    reason: graph?.reason ?? null,
    fingerprint: graph?.fingerprint ?? null,
    sourceRevision: graph?.source_revision ?? graph?.source?.source_revision ?? null,
    branch: graph?.branch ?? graph?.source?.branch ?? null,
    query: { seeds: requested },
    resolution: { resolved, unresolved, ambiguous },
    truncation: { context: contextTruncated, impact: impactTruncated },
    complete,
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
  { protectedOnly = false } = {},
) {
  const protectedGraph = state?.verification?.level === 'protected';
  if (protectedOnly && !protectedGraph) return [];

  const problems = [];
  if (!state?.fresh) problems.push(`repository graph is stale or missing (${state?.reason ?? 'unknown'})`);

  const unresolved = state?.resolution?.unresolved ?? [];
  const ambiguous = Object.keys(state?.resolution?.ambiguous ?? {});
  if (unresolved.length) problems.push(`repository graph has unresolved seed(s): ${unresolved.join(', ')}`);
  if (ambiguous.length) problems.push(`repository graph has ambiguous seed(s): ${ambiguous.join(', ')}`);

  const allowed = new Set(allowedProvenance);
  const disallowed = (state?.provenance ?? []).filter((value) => !allowed.has(value));
  if (disallowed.length) {
    problems.push(`repository graph uses non-hard-gate provenance: ${unique(disallowed).join(', ')}`);
  }
  if (protectedGraph && (state?.provenance ?? []).length === 0) {
    problems.push('repository graph has no hard-gate provenance for protected evidence');
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

export function missingGraphChecks(gates, checks, signature) {
  return checks.filter(
    (check) =>
      !(gates ?? []).some(
        (gate) =>
          gate.outcome === 'pass' &&
          gate.signature === signature &&
          gateMatchesCheck(gate.gate, check),
      ),
  );
}
