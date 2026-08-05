#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { compile } from './lib/zeus-engine.mjs';
const a = process.argv.slice(2);
const i = a.indexOf('--task');
const task = (i >= 0 ? a[i + 1] : readFileSync(0, 'utf8')).trim();
if (!task) {
  console.error('Provide --task or stdin');
  process.exit(2);
}
const c = compile(task);
const roles = [c.owner, ...c.reviewers];
const writers = roles.filter((x, i) => roles.indexOf(x) === i && !/qa|security/.test(x));
// Company-layer faces for Zeus owner roles; the mapping is documented in
// company/ZEUS-BRIDGE.md and adds a named senior owner, never authority.
const companyFace = {
  executor: 'Chief of Staff',
  'product-architecture': 'CTO',
  'geometry-bim': 'Geometry/BIM Lead',
  'editor-interaction': 'Frontend Lead',
  'rendering-performance': 'Frontend Lead',
  'arqfs-recovery': 'Backend Lead',
  'ui-visual': 'Design Lead',
  accessibility: 'Design Lead',
  security: 'Security Lead',
  'ai-arqscript': 'AI Lead',
  interoperability: 'Backend Lead',
  'incident-commander': 'Incident Commander',
  'qa-release': 'QA & Release Lead',
  'delivery-reliability': 'VP Engineering',
};
console.log(
  JSON.stringify(
    {
      accountable: c.owner,
      company: Object.fromEntries(
        [...new Set(roles)].map((r) => [r, companyFace[r] ?? 'Chief of Staff']),
      ),
      roles: [...new Set(roles)],
      waves: [
        { wave: 0, name: 'evidence', roles: [c.owner] },
        { wave: 1, name: 'implementation', roles: writers },
        { wave: 2, name: 'review', roles: c.reviewers },
        { wave: 3, name: 'delivery', roles: [c.owner, 'qa-release'] },
      ],
      rules: [
        'one accountable owner',
        'no concurrent writers to one canonical surface',
        'review current head before merge',
      ],
    },
    null,
    2,
  ),
);
