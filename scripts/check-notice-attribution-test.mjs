#!/usr/bin/env node
/**
 * Pins scripts/check-notice-attribution.mjs, in the same standalone shape as
 * scripts/check-secrets-test.mjs and scripts/zeus-guard-test.mjs.
 *
 * The defect this gate exists to catch is a legal file quietly disagreeing with
 * the build. A gate for that which silently stopped matching would recreate the
 * exact failure it was written for, only with a green tick over it. So every
 * rule has to prove it fires, and the pass case has to prove the rules can also
 * be satisfied - a check that only ever fails is as useless as one that only
 * ever passes.
 */
import { evaluateNotice, isBlanketAllowed } from './check-notice-attribution.mjs';

let failures = 0;
function check(description, condition) {
  if (condition) {
    process.stdout.write(`PASS ${description}\n`);
  } else {
    failures += 1;
    process.stderr.write(`FAIL ${description}\n`);
  }
}

const SBOM = {
  packageCount: 4,
  packages: [
    { name: 'left-pad', version: '1.0.0', licence: 'MIT' },
    { name: 'web-ifc', version: '0.0.77', licence: 'MPL-2.0' },
    { name: 'caniuse-lite', version: '1.0.0', licence: 'CC-BY-4.0' },
    { name: 'rc', version: '1.2.8', licence: '(BSD-2-Clause OR MIT OR Apache-2.0)' },
  ],
};

/** Satisfies every rule: no denial, every family listed, every exception named. */
const GOOD_NOTICE = [
  'ARQ incorporates third-party open-source components.',
  'Licence families: MIT, MPL-2.0, CC-BY-4.0, (BSD-2-Clause OR MIT OR Apache-2.0).',
  'Reviewed exceptions: `web-ifc` (MPL-2.0) and `caniuse-lite` (CC-BY-4.0).',
].join('\n');

check('a complete NOTICE produces no findings', evaluateNotice(GOOD_NOTICE, SBOM).length === 0);

check(
  'the historical denial is caught',
  evaluateNotice(
    `${GOOD_NOTICE}\nNo third-party code has been incorporated into this repository yet.`,
    SBOM,
  ).some((f) => f.includes('no third-party code')),
);

check(
  'the "planning documentation only" claim is caught',
  evaluateNotice(`${GOOD_NOTICE}\nIt currently contains planning documentation only.`, SBOM).some(
    (f) => f.includes('no third-party code'),
  ),
);

check(
  'an empty "(none yet)" component table is caught',
  evaluateNotice(`${GOOD_NOTICE}\n| _(none yet)_ | | |`, SBOM).some((f) =>
    f.includes('no third-party code'),
  ),
);

check(
  'a denial is not reported when the build genuinely has no packages',
  evaluateNotice('No third-party code has been incorporated into this repository yet.', {
    packageCount: 0,
    packages: [],
  }).length === 0,
);

check(
  'an unlisted licence family is caught',
  evaluateNotice(GOOD_NOTICE, {
    packageCount: 1,
    packages: [{ name: 'left-pad', version: '1.0.0', licence: 'EUPL-1.2' }],
  }).some((f) => f.includes('EUPL-1.2') && f.includes('review event')),
);

check(
  'an unnamed reviewed exception is caught',
  evaluateNotice(GOOD_NOTICE.replace('`web-ifc` (MPL-2.0) and ', ''), SBOM).some(
    (f) => f.includes('web-ifc') && f.includes('not blanket-allowed'),
  ),
);

check(
  'a blanket-allowed package need not be named individually',
  evaluateNotice(GOOD_NOTICE, SBOM).every((f) => !f.includes('left-pad')),
);

// The OR/AND asymmetry is the part most likely to be broken by a careless edit,
// and breaking it either way is silent: too permissive and a copyleft package
// goes unnamed, too strict and every permissive choice-of-licence package nags.
check('a permissive OR expression is blanket-allowed', isBlanketAllowed('(MIT OR WTFPL)'));
check(
  'an OR expression with one allowed branch is blanket-allowed',
  isBlanketAllowed('(BSD-2-Clause OR MIT OR Apache-2.0)'),
);
check(
  'an AND expression of allowed branches is blanket-allowed',
  isBlanketAllowed('(MIT AND Zlib)'),
);
check(
  'an AND expression containing a restricted branch is not blanket-allowed',
  !isBlanketAllowed('(MIT AND MPL-2.0)'),
);
check(
  'an OR expression of restricted branches is not blanket-allowed',
  !isBlanketAllowed('(MPL-2.0 OR GPL-3.0)'),
);
check('a bare restricted licence is not blanket-allowed', !isBlanketAllowed('MPL-2.0'));
check('a bare allowed licence is blanket-allowed', isBlanketAllowed('Apache-2.0'));

if (failures > 0) {
  process.stderr.write(`\n${failures} NOTICE attribution guard case(s) failed.\n`);
  process.exit(1);
}
process.stdout.write('\nNOTICE attribution guard test passed (15 cases).\n');
