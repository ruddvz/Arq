import { ctaBand, hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-004. Learning use, without weakening the professional positioning: the
 * same tool with the same stated limits, not a "student edition".
 *
 * Claim bindings: pub-student-hardware (browser-hardware-minimum, UNKNOWN),
 * pub-student-semantic-tools (current-door-window-room-authoring,
 * LIBRARY_ONLY) and pub-student-pricing (pricing, UNKNOWN). No published
 * minimum hardware profile exists, so this sheet states that rather than
 * naming a device class.
 */
export const studentsPage: Page = {
  meta: {
    id: 'PUB-004',
    route: '/students',
    title: 'For students',
    description:
      'ARQ for architecture students: a modelling tool with real units that runs in a browser and keeps projects in a local file format. Pricing is not set and the build is pre-release.',
  },
  render: () => html`
    ${hero({
      heading: 'Learn on the real thing.',
      lede: 'ARQ has no separate student edition. It is one pre-release tool with one set of stated limits, and several of the things that suit a small practice also suit a studio desk.',
    })}
    ${notes([
      {
        title: 'Why it suits studying',
        body: html`
          <p>
            ARQ runs in a browser, so a locked-down university machine can run it without an install
            or a licence server. The project has not published a minimum hardware profile yet, so
            this page will not tell you which laptops are enough. The repository's benchmark results
            are the only evidence that exists so far.
          </p>
          <p>
            Projects are local files you can carry on a USB stick or a cloud drive of your choosing.
            Elements are semantic, so the habits ARQ is built to teach are modelling habits rather
            than drafting tricks. Today the plan canvas draws walls; doors, openings and rooms are
            Release 1 scope and are not wired to the canvas yet.
          </p>
        `,
      },
      {
        title: 'What it will not teach you',
        kind: 'limit',
        body: html`
          <p>
            ARQ is not the industry's incumbent software and does not emulate it. If your course
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
            Pricing has not been set for anyone, students included. The project's research plan
            records an intention that student access should be affordable, which is an intention and
            not a commitment. The development build costs nothing to use while ARQ is pre-release.
            See <a href="/pricing">pricing</a> for what is and is not decided.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'Start where the work is.',
      'What the product does today, and what the plan editor is scoped to do next.',
      [
        { href: '/product', label: 'Product overview' },
        { href: '/changelog', label: 'Changelog' },
      ],
    )}
  `,
};
