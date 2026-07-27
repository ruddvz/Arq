import { ctaBand, hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-003. The residential and small-practice workflow. The SEO brief for
 * this sheet prohibits "works for every project" — the copy takes the
 * opposite position on purpose: Arq is for a specific kind of practice.
 */
export const architectsPage: Page = {
  meta: {
    id: 'PUB-003',
    route: '/architects',
    title: 'For architects',
    description:
      'Arq is being built for residential projects and small practices: measured plans, honest drawings and files that stay on your machine.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'PUB-003 · for architects',
      heading: 'Built for the practice of two, not the firm of two thousand.',
      lede: 'Arq is aimed at residential work and small practices: extensions, renovations, single dwellings. Not every project — that would be a lie — but these projects, done carefully.',
    })}
    ${notes([
      {
        title: 'The workflow Arq is shaped around',
        body: html`
          <p>
            Start from a site measure or an image underlay. Draw the existing walls, then the
            proposal: doors, windows, rooms. Dimension what matters, note what needs saying, and set
            a plan on a sheet. Export a vector PDF a builder can read. That loop — measure, draw,
            dimension, issue — is the benchmark workflow every Arq release is tested against.
          </p>
        `,
      },
      {
        title: 'Your file, your office',
        body: html`
          <p>
            Small practices cannot gamble their archive on a subscription's goodwill. An Arq project
            is one file on your disk, in a documented format built on SQLite, with journalled
            changes and a recovery path designed before any cloud feature. If you stop paying — or
            Arq stops existing — your drawings still open.
          </p>
        `,
      },
      {
        title: 'Drawings you can stand behind',
        body: html`
          <p>
            Arq does not check building codes, does not certify structures and will not pretend to.
            What it does is keep the model consistent — a door cannot sit outside its wall, a
            dimension cannot drift from the geometry it measures — and explain every refusal in
            plain language: what happened, why, what was affected, what remains safe.
          </p>
        `,
      },
      {
        title: 'Where it stands, honestly',
        body: html`
          <p>
            Arq is pre-release. The workspace, file format and drawing libraries exist and are
            tested; the full drawing loop is being wired together in the open. If you want to
            evaluate it for your practice, the <a href="/changelog">changelog</a> shows exactly what
            works today, and <a href="/contact">contact</a> explains how to reach the project.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'The details are the product.',
      'How Arq exchanges work with the tools your consultants use, and what it costs.',
      [
        { href: '/interoperability', label: 'Format support' },
        { href: '/pricing', label: 'Pricing' },
      ],
    )}
  `,
};
