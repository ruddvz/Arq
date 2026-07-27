import { hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-015. The spec calls for a lawyer-approved privacy notice; none exists
 * yet. What can be published honestly is the current factual practice —
 * which is unusually easy to state, because this site and the development
 * build collect nothing — plus a clear statement of what changes and when.
 */
export const privacyPage: Page = {
  meta: {
    id: 'PUB-015',
    route: '/legal/privacy',
    title: 'Privacy',
    documentTitle: 'Privacy notice — Arq',
    description:
      'Arq’s current privacy facts, stated plainly: this website sets no cookies and runs no analytics; the development build stores projects locally and sends no telemetry. A formal notice follows legal review.',
  },
  render: () => html`
    ${hero({
      heading: 'Privacy, as currently practised.',
      lede: 'A formal, lawyer-reviewed privacy notice will be published before any hosted service launches. Until then, here are the practices in force today — verifiable, because there is so little to verify.',
    })}
    ${notes([
      {
        title: 'This website',
        body: html`
          ${specList([
            { term: 'Cookies', detail: 'None set.' },
            {
              term: 'Analytics',
              detail: 'None running. No page-view tracking, no third-party scripts.',
            },
            {
              term: 'Requests',
              detail:
                'Static files served from this site’s own origin - fonts, styles and images included. No third-party resource is loaded.',
            },
            {
              term: 'Forms',
              detail: 'There are none. Nothing you do here is recorded by us.',
            },
          ])}
        `,
      },
      {
        title: 'The development build',
        body: html`
          ${specList([
            {
              term: 'Your projects',
              detail:
                'Stored on your device (browser storage or files you choose). Never uploaded - there is no server to upload to.',
            },
            {
              term: 'Accounts',
              detail: 'None exist. Nothing to sign up for, nothing to profile.',
            },
            {
              term: 'Telemetry',
              detail: 'None is sent. The development build reports nothing back.',
            },
            {
              term: 'AI training',
              detail:
                'Committed policy for any future service: no training on private project data by default.',
            },
          ])}
        `,
      },
      {
        title: 'What will change, and how you will know',
        body: html`
          <p>
            Hosted features - accounts, sync, shared links - change the privacy picture, and a
            formal notice will precede them: what is collected, the lawful basis, retention,
            processors, and your rights, reviewed by a lawyer before publication. This page keeps
            its plain-language summary alongside the formal text, and material changes will be dated
            in the <a href="/changelog">changelog</a>.
          </p>
        `,
      },
    ])}
  `,
};
