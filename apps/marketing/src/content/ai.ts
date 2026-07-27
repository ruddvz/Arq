import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-006. Previewable, validated, undoable AI operations. The SEO brief
 * prohibits "automatic compliant design"; the project's own kernel rules
 * require AI to propose typed operations with assumptions, validation, diff
 * and undo — that rule is the page.
 */
export const aiPage: Page = {
  meta: {
    id: 'PUB-006',
    route: '/ai',
    title: 'AI',
    description:
      'AI in Arq proposes; you dispose. Typed operations with stated assumptions, a preview diff, validation and undo — never silent edits, never claimed compliance.',
  },
  render: () => html`
    ${hero({
      heading: 'AI that shows its working.',
      lede: 'In Arq, AI is a careful junior who drafts a change and hands you the red pen — never a ghost hand moving your walls. Every proposal is inspectable before it exists, and reversible after.',
    })}
    ${notes([
      {
        title: 'The contract every AI feature must sign',
        body: html`
          <p>
            This is a design rule enforced in the project's kernel, not a marketing sentence. An AI
            capability ships only as a proposal with all five parts:
          </p>
          ${specList([
            { term: 'Intent', detail: 'What you asked, restated so you can catch a misreading.' },
            {
              term: 'Assumptions',
              detail: 'What the model had to guess, listed — not buried.',
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
        `,
      },
      {
        title: 'What AI in Arq will not claim',
        body: html`
          <p>
            Generated geometry is not accurate until you have checked it. Arq's AI does not produce
            building-code compliance, does not approve designs and does not replace professional
            judgement — the copy principles in the repository forbid describing it otherwise, and
            this site follows them.
          </p>
        `,
      },
      {
        title: 'Where it stands',
        body: html`
          <p>
            AI modifications are Release 3 scope — after the editor they would operate on is solid.
            Planned first steps are deliberately small: explain a selection, then single-step
            modifications under the contract above. Nothing AI-driven is in the development build
            today, and this page will change when that changes.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'The boring parts make the clever parts safe.',
      'Typed operations, validation and undo exist for every edit — AI or human. That is the product underneath.',
      [
        { href: '/product', label: 'Product overview' },
        { href: '/security', label: 'Security' },
      ],
    )}
  `,
};
