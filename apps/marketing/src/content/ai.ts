import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-006. The SEO brief prohibits "automatic compliant design"; the project's
 * kernel rules require AI to propose typed operations with assumptions,
 * validation, diff and undo.
 *
 * Claim binding: pub-ai-current (current-ai-authoring, PLANNED). Nothing
 * AI-driven exists in the current build, so the five-part contract is written
 * as the requirement a future capability must meet, never as a guardrail that
 * is currently protecting anyone.
 */
export const aiPage: Page = {
  meta: {
    id: 'PUB-006',
    route: '/ai',
    title: 'AI',
    description:
      'The contract any future AI capability in Arq must meet: typed operations, stated assumptions, a preview diff, validation and undo. No AI-driven authoring exists in the current development build.',
  },
  render: () => html`
    ${hero({
      heading: 'AI has to show its working before it changes anything.',
      lede: 'No AI-driven authoring exists in the Arq development build today. This page sets out the contract a future AI capability has to meet before it is allowed to touch a project.',
    })}
    ${notes([
      {
        title: 'The contract every AI feature must meet',
        body: html`
          <p>
            This is a design rule recorded in the project's guardrails
            (<code>docs/ai/AI-GUARDRAILS.md</code>), written before any AI capability exists. An AI
            capability may ship only as a proposal with all five parts:
          </p>
          ${specList([
            { term: 'Intent', detail: 'What you asked, restated so you can catch a misreading.' },
            {
              term: 'Assumptions',
              detail: 'What the model had to guess, listed rather than buried.',
            },
            {
              term: 'Operations',
              detail:
                'The exact typed edits it wants to make, the same operations your own tools produce.',
            },
            {
              term: 'Preview and validation',
              detail:
                'A diff against the current model, checked by the same validation as any manual edit.',
            },
            { term: 'Undo', detail: 'One step back, always, like any other operation.' },
          ])}
          <p>
            Nothing in the current build is enforcing this contract, because there is nothing yet
            for it to govern.
          </p>
        `,
      },
      {
        title: 'What AI in Arq will not claim',
        body: html`
          <p>
            Generated geometry is not accurate until you have checked it. Arq's AI will not produce
            building-code compliance, will not approve designs and will not replace professional
            judgement. The copy principles in the repository forbid describing it otherwise, and
            this site follows them.
          </p>
        `,
      },
      {
        title: 'Where it stands',
        body: html`
          <p>
            AI modifications are Release 3 scope, after the editor they would operate on is solid.
            The planned first steps are deliberately small: explain a selection, then single-step
            modifications under the contract above. This page will change when the build does.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'The boring parts make the clever parts safe.',
      'Typed operations, validation and undo are being built for every edit, whoever proposes it. That is the product underneath.',
      [
        { href: '/product', label: 'Product overview' },
        { href: '/security', label: 'Security' },
      ],
    )}
  `,
};
