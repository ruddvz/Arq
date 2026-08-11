#!/usr/bin/env node
/**
 * Binds NOTICE to the software bill of materials.
 *
 * NOTICE is the attribution file LICENSE points at. It spent the repository's
 * entire implementation history stating "No third-party code has been
 * incorporated into this repository yet - it currently contains planning
 * documentation only", with a component table reading "(none yet)", while the
 * build depended on hundreds of packages and the public /legal/open-source page
 * listed every one of them correctly. The repository told the truth to the
 * public and the opposite to anyone reading its own legal file.
 *
 * Nothing caught that, because nothing was checking. A legal document with no
 * gate is a document that drifts, and the two packages it most needed to name -
 * the reviewed exceptions, the only dependencies carrying obligations beyond
 * attribution - were exactly the ones missing.
 *
 * This check is deliberately narrow. It does not require NOTICE to restate
 * every package: a hand-maintained copy of the bill of materials is the thing
 * that goes stale, and duplicating 289 rows into a committed file would churn
 * on every dependency bump while adding nothing the generated sources do not
 * already say better. It requires three things that the generated sources
 * cannot say for themselves:
 *
 *   1. NOTICE must not deny incorporating third-party code while the bill of
 *      materials reports packages.
 *   2. Every licence family in the build must be listed. A new family is a
 *      legal review event, so it should fail a gate rather than appear quietly.
 *   3. Every package under a licence that is not blanket-allowed must be named.
 *      Those are the ones with real obligations - MPL-2.0's file-level copyleft,
 *      CC-BY-4.0's attribution - and "see the generated list" is not attribution.
 *
 * The SBOM is a build artifact rather than a tracked file, so this check reads
 * whatever `pnpm check:dependency-licences` last wrote and asks to be run after
 * it. It reports a missing SBOM as "cannot verify" rather than passing, on the
 * same principle as verify-vercel-routes: an unreadable source is not evidence
 * that the contract holds.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/**
 * Licences the policy allows without per-package review. Kept in sync with
 * scripts/check-dependency-licences.mjs and
 * docs/product/DEPENDENCY-AND-LICENCE-POLICY.md; anything outside this set is a
 * reviewed exception and must be named in NOTICE by package.
 */
export const BLANKET_ALLOWED_LICENCES = new Set([
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
  'BlueOak-1.0.0',
]);

/**
 * Phrasings that assert the repository carries no third-party code. Matched
 * case-insensitively against NOTICE. These are the specific claims that were
 * false, not a general prose filter.
 */
export const DENIAL_PATTERNS = [
  /no third-party code has been incorporated/i,
  /contains planning documentation only/i,
  /\(?\bnone yet\b\)?/i,
];

/**
 * A compound expression ("(A OR B)", "(A AND B)") is one licence family for
 * listing purposes: NOTICE explains the choice or the conjunction as a unit,
 * which is more useful to a reader than the branches listed separately.
 *
 * An OR expression is blanket-allowed when any branch is - a consumer may take
 * the permissive branch. An AND expression requires every branch to be, since
 * both apply at once. This mirrors check-dependency-licences.mjs, and getting
 * it backwards would either nag about permissive packages or stay silent about
 * a genuinely restrictive one.
 */
export function isBlanketAllowed(licence) {
  const trimmed = licence.trim();
  const inner = trimmed.startsWith('(') && trimmed.endsWith(')') ? trimmed.slice(1, -1) : trimmed;
  if (/\bOR\b/.test(inner)) {
    return inner.split(/\bOR\b/).some((branch) => isBlanketAllowed(branch));
  }
  if (/\bAND\b/.test(inner)) {
    return inner.split(/\bAND\b/).every((branch) => isBlanketAllowed(branch));
  }
  return BLANKET_ALLOWED_LICENCES.has(inner.trim());
}

/**
 * Pure so the self-test can exercise every rule without a repository, an
 * install, or a generated SBOM.
 */
export function evaluateNotice(noticeText, sbom) {
  const findings = [];
  const packages = sbom.packages ?? [];

  if (packages.length > 0) {
    for (const pattern of DENIAL_PATTERNS) {
      if (pattern.test(noticeText)) {
        findings.push(
          `NOTICE still says the repository carries no third-party code (matched ${pattern}), ` +
            `but the bill of materials reports ${packages.length} packages.`,
        );
      }
    }
  }

  const licences = [...new Set(packages.map((entry) => entry.licence))].sort();
  for (const licence of licences) {
    if (!noticeText.includes(licence)) {
      findings.push(
        `Licence family ${licence} is in the build but is not listed in NOTICE. ` +
          `A new licence family is a review event: confirm it against ` +
          `docs/product/DEPENDENCY-AND-LICENCE-POLICY.md, then list it.`,
      );
    }
  }

  for (const entry of packages) {
    if (isBlanketAllowed(entry.licence)) continue;
    if (!noticeText.includes(entry.name)) {
      findings.push(
        `${entry.name} is licensed ${entry.licence}, which is not blanket-allowed, ` +
          `and it is not named in NOTICE. A reviewed exception carries obligations ` +
          `beyond attribution and has to be named, not delegated to a generated list.`,
      );
    }
  }

  return findings;
}

function main() {
  const noticePath = path.join(repoRoot, 'NOTICE');
  const sbomPath = path.join(repoRoot, 'dependency-sbom.json');

  if (!existsSync(sbomPath)) {
    process.stderr.write(
      'Cannot verify NOTICE: dependency-sbom.json is absent, so there is nothing to check it ' +
        'against. Run `pnpm check:dependency-licences` first, which writes it. Refusing to ' +
        'report NOTICE as accurate on evidence that was never read.\n',
    );
    process.exit(1);
  }

  const sbom = JSON.parse(readFileSync(sbomPath, 'utf8'));
  const findings = evaluateNotice(readFileSync(noticePath, 'utf8'), sbom);

  if (findings.length > 0) {
    for (const finding of findings) process.stderr.write(`FAIL ${finding}\n`);
    process.exit(1);
  }

  const exceptions = (sbom.packages ?? []).filter((entry) => !isBlanketAllowed(entry.licence));
  process.stdout.write(
    `NOTICE agrees with the bill of materials: ${sbom.packages?.length ?? 0} packages, ` +
      `${new Set((sbom.packages ?? []).map((e) => e.licence)).size} licence families listed, ` +
      `${exceptions.length} reviewed exception(s) named ` +
      `(${exceptions.map((e) => e.name).join(', ') || 'none'}).\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
