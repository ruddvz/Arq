import { ctaBand, hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-003. The residential and small-practice workflow. The SEO brief for this
 * sheet prohibits "works for every project".
 *
 * Claim bindings: pub-architects-wall-workflow (current-wall-authoring,
 * CURRENT), pub-architects-lifetime (lifetime-local-access, PROHIBITED) and
 * pub-architects-model-integrity (semantic-model-integrity, LIBRARY_ONLY).
 * Present-tense workflow language stays on the tested wall path; the archive
 * paragraph describes the format and says what has not been decided instead of
 * guaranteeing future access.
 */
export const architectsPage: Page = {
  meta: {
    id: 'PUB-003',
    route: '/architects',
    title: 'For architects',
    family: 'story',
    description:
      'ARQ is being developed for residential projects and small practices: measured plans, a documented local project format, and a development build whose current state is published rather than implied.',
  },
  render: () => html`
    ${hero({
      heading: 'Built for the practice of two, not the firm of two thousand.',
      lede: 'ARQ is aimed at residential work and small practices: extensions, renovations, single dwellings. It is being developed for those projects specifically, and it is still pre-release.',
    })}
    ${notes([
      {
        title: 'The workflow ARQ is shaped around',
        body: html`
          <p>
            Start from a site measure or an image underlay. Draw the existing walls, then the
            proposal: doors, windows, rooms. Dimension what matters, note what needs saying, and set
            a plan on a sheet. Export a vector PDF a builder can read.
          </p>
          <p>
            That loop is the benchmark workflow every ARQ release is tested against. In the current
            development build the wall step is the part you can actually do: drawing, snapping,
            selection and validated edits in the plan canvas. The rest is Release 1 scope.
          </p>
        `,
      },
      {
        title: 'Your file, your office',
        body: html`
          <p>
            An ARQ project is one file on your disk, in a documented format built on SQLite, with
            journalled changes and a recovery path designed before any cloud feature. The format
            layer is built and tested. Reading an existing <code>.arq</code> file back into a live
            browser project is not wired yet.
          </p>
          <p>
            What ARQ can commit to today is the shape of the format and the fact that it is
            documented in the repository. Commercial terms are not set, so this page makes no
            promise about what happens to your archive if you stop paying or if the project ends.
            See <a href="/pricing">pricing</a> for the state of that decision.
          </p>
        `,
      },
      {
        title: 'Drawings you can stand behind',
        body: html`
          <p>
            ARQ does not check building codes and does not certify structures. Its intended job is
            to keep the model consistent, so that a door cannot sit outside its wall and a dimension
            cannot drift from the geometry it measures, and to explain every refusal in plain
            language: what happened, why, what was affected, what remains safe.
          </p>
          <p>
            The validation rules and the element libraries behind that behaviour are implemented and
            tested. They apply end to end only where the tools are wired to the canvas, which today
            means walls.
          </p>
        `,
      },
      {
        title: 'Where it stands today',
        body: html`
          <p>
            ARQ is pre-release. The workspace, file format and drawing libraries exist and are
            tested, and the drawing loop is being connected in the open. If you want to evaluate it
            for your practice, the <a href="/changelog">changelog</a> shows what has been built and
            when, and <a href="/contact">contact</a> explains how to reach the project.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'The details are the product.',
      'How ARQ exchanges work with the tools your consultants use, and what it costs.',
      [
        { href: '/interoperability', label: 'Format support' },
        { href: '/pricing', label: 'Pricing' },
      ],
    )}
  `,
};
