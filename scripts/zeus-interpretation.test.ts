// Zeus 5: the reading the operator sees before any work happens.
//
// The whole value of this layer is that a misread is visible in one glance, so
// every test here is about what the operator can SEE, not about internal fields.
// Where a test claims to pin a fix it was run against the pre-fix engine first.
import { describe, expect, it } from 'vitest';

import { compile, interpret, markdown, route } from './lib/zeus-engine.mjs';

const reading = (task: string) => route(task).interpretation;
const rendered = (task: string) => markdown(compile(task));

describe('how Zeus says it read the request', () => {
  it('reads a question as a question, and says it is not an instruction', () => {
    const i = reading('Explain how the .arq migration recovery works');
    expect(i.as).toContain('question');
    expect(i.not).toContain('change anything');
  });

  it('reads an instruction as an instruction, and says it is not a plan', () => {
    const i = reading('Add a door placement tool to the plan canvas');
    expect(i.as).toContain('change the repository');
    expect(i.not).toContain('plan');
  });

  it('reads a plan request as a plan, and withholds authorisation to build it', () => {
    const i = reading('Plan how we would migrate the project format');
    expect(i.as).toContain('plan');
    expect(i.not).toContain('authorisation');
  });

  it('reads an audit as inspection, not permission to change', () => {
    const i = reading('Review the snapping code and tell me what is wrong with it');
    expect(i.as).toContain('inspect');
    expect(i.not).toContain('authorisation to change it');
  });

  it('covers every mode the compiler can produce', () => {
    // Derived from the engine, not a pinned list: a new mode with no reading
    // would otherwise fall through to the implement wording and quietly mislead.
    const tasks = [
      'Explain how snapping works',
      'Plan the migration',
      'Audit the renderer for defects',
      'Fix the snapping bug',
      'Deploy the marketing site to production',
      'Production is down and users cannot open files',
    ];
    const modes = new Set(tasks.map((t) => route(t).mode));
    expect(modes.size).toBeGreaterThanOrEqual(5);
    for (const task of tasks) {
      const i = reading(task);
      expect(i.as.length).toBeGreaterThan(10);
      expect(i.not.length).toBeGreaterThan(10);
    }
  });
});

describe('the inferences it admits to', () => {
  it('says when it invented the delivery stop rather than reading one', () => {
    const i = reading('Fix a README typo');
    expect(i.assumptions.join(' ')).toContain('no delivery stop was stated');
    expect(i.assumptions.join(' ')).toContain('goes no further');
  });

  it('says when the stop came from the operator instead', () => {
    const i = reading('Fix the snap tie-break and open a pull request');
    expect(i.assumptions.join(' ')).toContain('taken from your words');
  });

  it('admits that it saw the sensitive topic and still held the risk down', () => {
    // Without this the operator cannot tell "Zeus knows this is about
    // production and is only reading" apart from "Zeus missed it entirely".
    const i = reading('Explain how the production deployment rollback works');
    expect(i.assumptions.join(' ')).toContain('reading about a risky area is not changing it');
  });

  it('does not claim a downgrade when the topic was never risky', () => {
    const i = reading('Explain how the button component is styled');
    expect(i.assumptions.join(' ')).not.toContain('risk held at moderate');
  });

  it('names the blast radius when that, not the risk, raised the tier', () => {
    // Driven through interpret() directly. Measured: no prompt-only input
    // reaches this branch, because the wording that implies a persistent radius
    // already sets risk high by keyword. Testing it through route() would have
    // pinned nothing while looking like coverage.
    const i = interpret('touch the journal', {
      mode: 'implement',
      risk: 'moderate',
      tier: 'deep',
      deliveryStop: 'local-green',
      stopSource: 'assumed',
      blastRadius: 'persistent',
      modules: ['arqfs'],
      tierRaisedByRadius: true,
    });
    expect(i.assumptions.join(' ')).toContain('tier raised to deep by a persistent blast radius');
    expect(i.assumptions.join(' ')).toContain('not by the size of the change');
  });

  it('names what raised the risk when something did', () => {
    const i = interpret('overwrite the file', {
      mode: 'implement',
      risk: 'high',
      tier: 'deep',
      deliveryStop: 'local-green',
      stopSource: 'assumed',
      blastRadius: 'persistent',
      modules: ['arqfs'],
      riskRaisedBy: 'irreversible',
    });
    expect(i.assumptions.join(' ')).toContain(
      'risk raised to high because the work is irreversible',
    );
  });

  it('warns that a change-mode reading came from words, not from changed paths', () => {
    // "Rename a variable in packages/arqfs/src/open.ts" reads as low / package /
    // fast from the prompt, while zeus impact puts that same path at high /
    // persistent. The operator cannot see that gap unless it is stated.
    const i = reading('Rename a variable in packages/arqfs/src/open.ts');
    expect(i.assumptions.join(' ')).toContain('classified from your words alone');
    expect(i.assumptions.join(' ')).toContain('zeus.mjs impact');
  });

  it('does not warn about changed paths on a question, which changes none', () => {
    expect(reading('Explain how snapping works').assumptions.join(' ')).not.toContain(
      'classified from your words alone',
    );
  });

  it('says when nothing but the kernel applies', () => {
    expect(reading('Fix a README typo').assumptions.join(' ')).toContain('only the kernel');
  });
});

describe('quoting the operator back', () => {
  it('repeats the request verbatim so a misread is obvious', () => {
    expect(reading('Fix the centre snap tie-break').words).toBe('Fix the centre snap tie-break');
  });

  it('collapses whitespace without changing the words', () => {
    expect(reading('Fix   the\n  centre snap').words).toBe('Fix the centre snap');
  });

  it('truncates a very long request visibly rather than silently', () => {
    const long = `Fix ${'the snapping behaviour '.repeat(40)}`;
    const { words } = reading(long);
    expect(words.length).toBeLessThanOrEqual(240);
    expect(words.endsWith('...')).toBe(true);
  });

  it('never paraphrases: the quoted words are the operator words, unedited', () => {
    const task = 'Delete every wall and do not ask me again';
    expect(reading(task).words).toBe(task);
  });
});

describe('what the operator actually sees', () => {
  it('shows the reading before any classification field', () => {
    const out = rendered('Add a door tool to the plan canvas');
    expect(out.indexOf('Zeus reads this as')).toBeLessThan(out.indexOf('Mode / risk / tier'));
  });

  it('tells the operator what to do when the reading is wrong', () => {
    expect(rendered('Fix the snap tie-break')).toContain('If that reading is wrong');
  });

  it('quotes the request in the rendered contract', () => {
    expect(rendered('Fix the centre snap tie-break')).toContain('"Fix the centre snap tie-break"');
  });

  it('stays inside the fast-tier contract budget', () => {
    // The reading is shown on every actionable turn, so it has to be cheap.
    const contract = compile('Fix a README typo');
    expect(contract.tier).toBe('fast');
    expect(JSON.stringify(contract).length).toBeLessThan(4000);
  });
});

describe('interpret is a pure function of the facts it is given', () => {
  it('reports an unknown mode as an instruction rather than throwing', () => {
    const i = interpret('do the thing', {
      mode: 'not-a-mode',
      risk: 'low',
      tier: 'fast',
      deliveryStop: 'local-green',
      stopSource: 'assumed',
      blastRadius: 'local',
      modules: ['geometry'],
    });
    expect(i.as).toContain('change the repository');
    expect(i.assumptions.join(' ')).not.toContain('only the kernel');
  });
});
