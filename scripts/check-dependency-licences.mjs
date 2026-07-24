#!/usr/bin/env node
/**
 * ARQ-016: add SBOM and licence scan.
 *
 * Enforces docs/product/DEPENDENCY-AND-LICENCE-POLICY.md's allow-list against
 * every installed dependency (via `pnpm licenses list --json`, already
 * available since pnpm itself is - no new dependency added for this) and
 * writes a minimal SBOM (name/version/licence per package) as a build
 * artifact. Exits non-zero (failing CI) if any package's licence is outside
 * both the allow-list and the reviewed-exceptions list.
 *
 * Deliberately not a CycloneDX/SPDX-format generator - see the policy doc's
 * own "Enforcement" section for why that would be a needless new dependency
 * for this repository's actual, narrower need.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const ALLOWED_LICENCES = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'Unlicense',
  'CC0-1.0',
  'Python-2.0',
  'Zlib',
]);

/** docs/product/DEPENDENCY-AND-LICENCE-POLICY.md's "Reviewed exceptions" table - keep in sync with that file. */
const REVIEWED_EXCEPTION_LICENCES = new Set(['MPL-2.0', 'CC-BY-4.0']);

function isSimpleLicenceAllowed(licence) {
  return ALLOWED_LICENCES.has(licence) || REVIEWED_EXCEPTION_LICENCES.has(licence);
}

/**
 * "(A OR B)" is a choice - allowed if any branch is allowed, since a
 * consumer can pick the permissive one. "(A AND B)" means both licences
 * apply simultaneously - allowed only if every branch is allowed, since
 * there is no escaping the stricter one.
 */
function isCompoundLicenceAllowed(licence) {
  const inner = licence.replace(/^\(|\)$/g, '');
  if (/\s+OR\s+/i.test(inner)) {
    const branches = inner.split(/\s+OR\s+/i).map((branch) => branch.trim());
    return branches.some((branch) => isSimpleLicenceAllowed(branch));
  }
  if (/\s+AND\s+/i.test(inner)) {
    const branches = inner.split(/\s+AND\s+/i).map((branch) => branch.trim());
    return branches.every((branch) => isSimpleLicenceAllowed(branch));
  }
  return isSimpleLicenceAllowed(inner);
}

function isLicenceAllowed(licence) {
  if (isSimpleLicenceAllowed(licence)) {
    return true;
  }
  if (licence.startsWith('(')) {
    return isCompoundLicenceAllowed(licence);
  }
  return false;
}

const raw = execSync('pnpm licenses list --json', {
  cwd: repoRoot,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const byLicence = JSON.parse(raw);

const sbomEntries = [];
const violations = [];

for (const [licence, packages] of Object.entries(byLicence)) {
  const allowed = isLicenceAllowed(licence);
  for (const pkg of packages) {
    for (const version of pkg.versions) {
      sbomEntries.push({ name: pkg.name, version, licence });
    }
    if (!allowed) {
      violations.push({ name: pkg.name, versions: pkg.versions, licence });
    }
  }
}

sbomEntries.sort((a, b) =>
  a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name),
);

const sbomPath = path.join(repoRoot, 'dependency-sbom.json');
writeFileSync(
  sbomPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      packageCount: sbomEntries.length,
      packages: sbomEntries,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Wrote ${sbomEntries.length} package entries to ${path.relative(repoRoot, sbomPath)}`);

if (violations.length > 0) {
  console.error(
    `\n${violations.length} package(s) use a licence outside the allow-list (docs/product/DEPENDENCY-AND-LICENCE-POLICY.md):`,
  );
  for (const violation of violations) {
    console.error(`  - ${violation.name}@${violation.versions.join(',')}: ${violation.licence}`);
  }
  process.exit(1);
}

console.log('All dependency licences are within policy.');
