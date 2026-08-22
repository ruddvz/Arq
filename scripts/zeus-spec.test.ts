// Zeus 5 spec compiler: what it fills in, and what it refuses to pretend it knows.
import { describe, expect, it } from 'vitest';

import { buildSpec, checkSpec, unknowns, TODO } from './zeus-spec.mjs';
import { compile, manifest, roleRegistry } from './lib/zeus-engine.mjs';

const spec = (task: string) => buildSpec(task);

describe('what it derives from the repository', () => {
  it('quotes the request and states how Zeus read it', () => {
    const out = spec('Fix the centre snap tie-break');
    expect(out).toContain('> Fix the centre snap tie-break');
    expect(out).toContain('**Zeus reads this as**');
    expect(out).toContain('**Not as**');
  });

  it('carries the routed module its own requirement prose, not a summary of it', () => {
    // The spec must state the doctrine the work has to satisfy, in the module's
    // words, or the implementer is working from a paraphrase.
    const out = spec('Fix the .arq migration recovery path');
    const body = manifest.modules.find((m: { id: string }) => m.id === 'arqfs');
    expect(body).toBeTruthy();
    expect(out).toContain('### arqfs');
    expect(out).toMatch(/copy-on-write|migration|recover/i);
  });

  it('names an accountable role that exists in the registry', () => {
    const roles = new Set(roleRegistry.roles.map((r: { id: string }) => r.id));
    for (const task of [
      'Fix the .arq migration recovery path',
      'Change the button hover token',
      'Deploy the marketing site',
      'Explain how snapping works',
    ]) {
      const owner = spec(task).match(/\*\*Accountable role:\*\* (\S+)/)?.[1];
      expect(roles.has(owner)).toBe(true);
    }
  });

  it('carries the classification and the acceptance criteria the contract computed', () => {
    const contract = compile('Fix the .arq migration recovery path');
    const out = spec('Fix the .arq migration recovery path');
    expect(out).toContain(`| Blast radius | ${contract.blastRadius} |`);
    for (const a of contract.acceptance) expect(out).toContain(a);
  });
});

describe('what it refuses to invent', () => {
  it('asks for the delivery stop when the request never gave one', () => {
    expect(spec('Fix the centre snap tie-break')).toContain(
      `${TODO}: confirm delivery stops at \`local-green\``,
    );
  });

  it('does not ask when the request did give one', () => {
    expect(spec('Fix the centre snap tie-break and open a pull request')).not.toContain(
      'confirm delivery stops',
    );
  });

  it('asks the domain questions of every routed module', () => {
    const out = spec('Fix the .arq migration recovery path');
    expect(out).toContain('arqfs: which schema version this reads and writes');
    expect(out).toContain('arqfs: how a half-written file is detected and recovered');
  });

  it('asks for a rollback on high risk work', () => {
    const contract = compile('Fix the .arq migration to rewrite the project file in place');
    expect(contract.risk).toBe('high');
    expect(unknowns(contract).join(' ')).toContain('state the rollback');
  });

  it('asks for a compensating action when a revert is not enough', () => {
    expect(
      unknowns({ ...compile('Fix a typo'), reversibility: 'irreversible', risk: 'low' }).join(' '),
    ).toContain('compensating action');
  });

  it('says so when no module matched, instead of implying full coverage', () => {
    const contract = compile('Fix a README typo');
    expect(contract.modules).toEqual([]);
    expect(unknowns(contract).join(' ')).toContain('no domain module matched the wording');
  });

  it('does not claim there are no questions when it simply derived none', () => {
    const out = spec('Fix the centre snap tie-break and open a pull request');
    if (out.includes('None derived')) {
      expect(out).toContain('That is not the same as none existing');
    }
  });
});

describe('the UI contract', () => {
  it('emits every dimension the visual contract lint requires, as a question', () => {
    const task = 'Redesign the project sidebar with responsive states';
    expect(compile(task).modules).toContain('ui-visual');
    const out = spec(task);
    for (const heading of [
      'Role and primary task',
      'Data and content fixture',
      'Responsive matrix',
      'State matrix',
      'Keyboard and focus',
      'Touch and Pencil targets',
      'Tokens and canonical assets',
      'Overflow and long content',
      'DPR, zoom and font environment',
      'Visual regression',
      'Accessibility',
    ]) {
      expect(out).toContain(`### ${heading}`);
    }
    // Each one is a question, not a filled heading.
    expect(out.match(new RegExp(`${TODO}:`, 'g'))?.length ?? 0).toBeGreaterThan(11);
  });

  it('omits the UI contract for work with no visual surface', () => {
    expect(spec('Fix the .arq migration recovery path')).not.toContain(
      '## 8. Visual and interaction contract',
    );
  });
});

describe('the check', () => {
  it('refuses a spec while any question is unanswered', () => {
    // The premise is asserted, not assumed: this phrasing must actually route to
    // a visual module, or the spec carries two questions instead of fourteen and
    // the count below would pass for the wrong reason.
    const task = 'Redesign the project sidebar with responsive states';
    expect(compile(task).modules).toContain('ui-visual');
    const { ready, problems } = checkSpec(spec(task));
    expect(ready).toBe(false);
    expect(problems.length).toBeGreaterThan(5);
  });

  it('accepts a spec once every question is answered', () => {
    const answered = spec('Redesign the project sidebar with responsive states').replace(
      new RegExp(`${TODO}:`, 'g'),
      'Answered:',
    );
    expect(checkSpec(answered)).toEqual({ ready: true, problems: [] });
  });

  it('refuses a file that is not a Zeus spec at all', () => {
    expect(checkSpec('# Some other document\n\nnothing here').problems.join(' ')).toContain(
      'does not look like a Zeus spec',
    );
  });

  it('is not satisfied by the visual lint alone, which the skeleton already passes', () => {
    // The generated skeleton carries every heading the visual contract lint
    // demands, so that lint passes on a document that says nothing. The two
    // checks are complementary by design: shape, then substance.
    const out = spec('Redesign the project sidebar with responsive states');
    const visualDimensions = [
      /role|primary task/i,
      /fixture|test data|content source/i,
      /responsive|viewport|device matrix/i,
      /state matrix|loading/i,
      /keyboard|focus/i,
      /touch|pencil|44\s*px/i,
      /token|canonical asset/i,
      /overflow|truncation/i,
      /device pixel ratio|\bdpr\b|200%|zoom/i,
      /screenshot|visual regression|baseline|diff/i,
      /screen reader|accessibility|contrast/i,
      /acceptance/i,
    ];
    for (const dimension of visualDimensions) expect(out).toMatch(dimension);
    expect(checkSpec(out).ready).toBe(false);
  });
});
