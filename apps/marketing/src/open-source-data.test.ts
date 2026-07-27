import { describe, expect, it } from 'vitest';
import { groupByLicence, type Sbom } from './open-source-data.js';

const FIXTURE: Sbom = {
  generatedAt: '2026-07-27T00:00:00.000Z',
  packageCount: 4,
  packages: [
    { name: 'zeta', version: '1.0.0', licence: 'MIT' },
    { name: 'alpha', version: '2.0.0', licence: 'MIT' },
    { name: 'beta', version: '3.0.0', licence: 'Apache-2.0' },
    { name: 'gamma', version: '0.1.0', licence: 'MIT' },
  ],
};

describe('groupByLicence', () => {
  it('orders groups by package count, then licence name', () => {
    const groups = groupByLicence(FIXTURE);
    expect(groups.map((group) => group.licence)).toEqual(['MIT', 'Apache-2.0']);
  });

  it('sorts packages inside a group by name', () => {
    const mit = groupByLicence(FIXTURE)[0];
    expect(mit?.packages.map((pkg) => pkg.name)).toEqual(['alpha', 'gamma', 'zeta']);
  });
});
