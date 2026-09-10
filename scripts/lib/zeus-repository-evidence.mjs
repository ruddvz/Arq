import {
  graphStatus,
  loadConfig,
  preflightFromGraph,
  readSnapshot,
} from '../zeus-repository-intelligence.mjs';

const RISK_RANK = { low: 0, moderate: 1, high: 2, critical: 3 };

export function verificationCommandsToChecks(commands = []) {
  const checks = new Set();
  for (const command of commands) {
    const value = String(command).trim();
    if (/\bformat:check\b/.test(value)) checks.add('format:check');
    if (/\blint\b/.test(value)) checks.add('lint');
    if (/\btypecheck\b/.test(value)) checks.add('typecheck');
    if (/\btest\b/.test(value)) checks.add('test');
    if (/\bbuild\b/.test(value)) checks.add('build');
    if (/\bzeus:validate\b/.test(value)) checks.add('zeus:validate');
    if (/\bzeus:drift\b/.test(value)) checks.add('zeus:drift');
  }
  return [...checks];
}

export function repositoryEvidence(root, seeds) {
  const config = loadConfig(root);
  const status = graphStatus(root, config);
  if (!status.fresh) {
    const commands = [...(config.verification_frontiers?.protected ?? [])];
    return {
      fresh: false,
      uncertainty: true,
      reason: status.reason,
      source_revision: status.source_revision,
      branch: status.branch,
      fingerprint: status.fingerprint,
      seeds: { requested: [...seeds], resolved: [], unresolved: [...seeds], ambiguous: {} },
      verification: {
        level: 'protected',
        uncertain: true,
        domains: [],
        commands,
      },
      canonical_or_protected: [],
    };
  }

  const snapshot = readSnapshot(root);
  const preflight = preflightFromGraph(snapshot.nodes, snapshot.edges, seeds, config);
  return {
    fresh: true,
    reason: status.reason,
    source_revision: status.source_revision,
    branch: status.branch,
    fingerprint: status.fingerprint,
    ...preflight,
  };
}

export function applyGraphEscalation({ risk, checks }, evidence) {
  const nextChecks = new Set(checks ?? []);
  for (const check of verificationCommandsToChecks(evidence?.verification?.commands)) {
    nextChecks.add(check);
  }

  let nextRisk = risk;
  if (evidence?.verification?.level === 'protected' && RISK_RANK[nextRisk] < RISK_RANK.high) {
    nextRisk = 'high';
  }

  return { risk: nextRisk, checks: [...nextChecks] };
}

export function graphMarkdown(evidence) {
  const resolved = evidence?.seeds?.resolved?.length ?? 0;
  const unresolved = evidence?.seeds?.unresolved?.length ?? 0;
  const level = evidence?.verification?.level ?? 'unknown';
  return [
    '## Repository intelligence',
    '',
    `- Graph: ${evidence?.fresh ? 'fresh' : 'stale or missing'}`,
    `- Uncertainty: ${Boolean(evidence?.uncertainty)}`,
    `- Verification frontier: ${level}`,
    `- Seeds: ${resolved} resolved, ${unresolved} unresolved`,
    evidence?.fingerprint ? `- Fingerprint: ${evidence.fingerprint}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
