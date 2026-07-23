import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const config = JSON.parse(readFileSync(join(root, '.zeus', 'config.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, '.zeus', 'module-manifest.json'), 'utf8'));
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const has = (s, re) => re.test(s);
export function classify(task) {
  const s = norm(task);
  let mode = 'implement';
  if (
    has(s, /\b(outage|incident|broken production|production down|ci failing|deployment failing)\b/)
  )
    mode = 'incident';
  else if (has(s, /\b(release|deploy|production|ship)\b/)) mode = 'release';
  else if (has(s, /\b(audit|critique|review)\b/)) mode = 'audit';
  else if (
    has(s, /\b(plan|roadmap|research|proposal)\b/) &&
    !has(s, /\b(implement|build|fix|make|create|update)\b/)
  )
    mode = 'plan';
  else if (
    has(s, /\b(explain|what is|why does|how does)\b/) &&
    !has(s, /\b(fix|build|update|change)\b/)
  )
    mode = 'answer';
  let risk = 'moderate';
  if (
    has(
      s,
      /data loss|security breach|corrupt|rollback production|canonical units?|production migration/,
    )
  )
    risk = 'critical';
  else if (
    has(
      s,
      /\.arq|sqlite|opfs|migration|recovery|sync|geometry|topology|constraint|security|permission|auth|ai apply|ifc|dxf|merge|deploy|production/,
    )
  )
    risk = 'high';
  else if (has(s, /\b(copy|docs?|typo|rename|explain)\b/)) risk = 'low';
  const tier = risk === 'low' ? 'fast' : risk === 'moderate' ? 'standard' : 'deep';
  let deliveryStop = mode === 'answer' ? 'answer' : mode === 'plan' ? 'plan' : 'local-green';
  if (has(s, /pull request|\bpr\b/)) deliveryStop = 'pr-open';
  if (has(s, /\bci\b/)) deliveryStop = 'ci-green';
  if (has(s, /\bmerge\b/)) deliveryStop = 'merged';
  if (mode === 'release' || has(s, /deploy|production|ship/)) deliveryStop = 'production-verified';
  return { mode, risk, tier, deliveryStop };
}
export function route(task, forcedTier = null) {
  const c = classify(task);
  const tier = forcedTier ?? c.tier;
  const s = norm(task);
  const scored = manifest.modules
    .map((m) => ({
      id: m.id,
      path: m.path,
      score: m.triggers.reduce((n, t) => n + (s.includes(t.toLowerCase()) ? 1 : 0), 0),
      priority: m.priority,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.priority - a.priority);
  if (c.mode === 'release' && !scored.some((x) => x.id === 'release-production'))
    scored.unshift({
      id: 'release-production',
      path: '.zeus/modules/release-production.md',
      score: 2,
      priority: 99,
    });
  if (c.mode === 'incident' && !scored.some((x) => x.id === 'incident'))
    scored.unshift({ id: 'incident', path: '.zeus/modules/incident.md', score: 3, priority: 100 });
  const limit = config.budgets[tier].modules;
  return { ...c, tier, modules: scored.slice(0, limit) };
}
const roleMap = {
  architecture: 'product-architecture',
  geometry: 'geometry-bim',
  'editor-input': 'editor-interaction',
  arqfs: 'arqfs-recovery',
  rendering: 'rendering-performance',
  'ui-visual': 'ui-visual',
  accessibility: 'accessibility',
  security: 'security',
  'github-cicd': 'delivery-reliability',
  'release-production': 'delivery-reliability',
  ai: 'ai-arqscript',
  interoperability: 'interoperability',
  incident: 'incident-commander',
};
export function compile(task) {
  const r = route(task);
  const budget = config.budgets[r.tier];
  const ids = r.modules.map((x) => x.id);
  const owner =
    roleMap[ids[0]] ??
    (r.mode === 'release' || r.mode === 'incident' ? 'delivery-reliability' : 'executor');
  const reviewers = [];
  if (['high', 'critical'].includes(r.risk)) {
    reviewers.push('qa-release');
    if (!ids.includes('security')) reviewers.push('security');
  }
  const acceptance = [
    'authoritative current state inspected',
    'requested success and failure paths work',
    'applicable Arq invariants remain satisfied',
    `${r.deliveryStop} has current evidence`,
  ];
  if (ids.includes('ui-visual'))
    acceptance.push('visual states, responsive matrix and screenshot diff reviewed');
  if (ids.includes('arqfs'))
    acceptance.push('integrity, recovery and source-preservation evidence passes');
  const checks = [
    'ranked context retrieval',
    'impact-selected focused checks',
    'actual output inspection',
  ];
  if (r.tier !== 'fast')
    checks.push('affected package quality checks', 'independent critique pass');
  if (r.tier === 'deep') checks.push('uncached protected gates and rollback evidence');
  return {
    version: '4.0.0',
    intent: task.trim().slice(0, 320),
    mode: r.mode,
    risk: r.risk,
    tier: r.tier,
    deliveryStop: r.deliveryStop,
    modules: ids,
    modulePaths: r.modules.map((x) => x.path),
    owner,
    reviewers,
    scope: [`deliver the requested Arq outcome to ${r.deliveryStop}`],
    nonGoals: [
      'no unrelated platform expansion',
      'no bypass of safety, evidence or authority gates',
    ],
    acceptance,
    checks,
    budget,
    cachePolicy:
      r.tier === 'fast' ? 'fingerprinted short-lived pass cache allowed' : 'no critical gate cache',
  };
}
export function markdown(c) {
  return `# Zeus 4 Compact Contract\n\n**Mode / risk / tier / stop:** ${c.mode} / ${c.risk} / ${c.tier} / ${c.deliveryStop}\n**Owner:** ${c.owner}${c.reviewers.length ? ` · Review: ${c.reviewers.join(', ')}` : ''}\n**Modules:** ${c.modules.join(', ') || 'kernel only'}\n\n**Acceptance**\n${c.acceptance.map((x) => `- [ ] ${x}`).join('\n')}\n\n**Checks**\n${c.checks.map((x) => `- ${x}`).join('\n')}\n`;
}
export { config, manifest };
