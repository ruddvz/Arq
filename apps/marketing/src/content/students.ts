import { ctaBand, hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-004. Learning use, without weakening the professional positioning:
 * the same tool, honestly scoped — not a "student edition".
 */
export const studentsPage: Page = {
  meta: {
    id: 'PUB-004',
    route: '/students',
    title: 'For students',
    description:
      'Arq for architecture students: a real modelling tool with real units that runs in the browser and keeps projects in files you own — no licence server between you and your work.',
  },
  render: () => html`
    ${hero({
      heading: 'Learn on the real thing.',
      lede: 'Arq has no separate student edition. It is one tool with stated limits, and several of the things that make it good for a small practice make it good for a studio desk.',
    })}
    ${notes([
      {
        title: 'Why it suits studying',
        body: html`
          <p>
            It runs in a browser, so a locked-down university machine or a modest laptop is enough.
            Projects are single local files you can carry on a USB stick or a cloud drive of your
            choosing. And because elements are semantic — walls, openings, rooms — the habits you
            build are modelling habits, not drafting tricks.
          </p>
        `,
      },
      {
        title: 'What it will not teach you',
        body: html`
          <p>
            Arq is not the industry's incumbent software and does not emulate it. If your course
            requires Revit or ArchiCAD deliverables, you will still need them. What transfers is the
            thinking: building a consistent model, dimensioning with intent, and reading what a
            drawing actually says.
          </p>
        `,
      },
      {
        title: 'Cost, plainly',
        body: html`
          <p>
            Pricing has not been set — for anyone, students included. The intent recorded in the
            project's research plan is that student access must be genuinely affordable, and the
            development build is free to use while Arq is pre-release. See
            <a href="/pricing">pricing</a> for exactly what is and is not decided.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'Start where the work is.',
      'What the product does today, and what the plan editor will do next.',
      [
        { href: '/product', label: 'Product overview' },
        { href: '/changelog', label: 'Changelog' },
      ],
    )}
  `,
};
