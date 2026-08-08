import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-010. Security and privacy without overclaiming certification, which is
 * the SEO brief's prohibited claim for this sheet. Baseline items mirror
 * SECURITY.md.
 *
 * Claim binding: pub-security-network (no-network-data-transfer, UNKNOWN).
 * A current browser observation check now covers the exercised wall, 3D and
 * file-panel path. An approved privacy statement is still missing, so the page
 * reports the evidence without turning it into an absolute product promise.
 */
export const securityPage: Page = {
  meta: {
    id: 'PUB-010',
    route: '/security',
    title: 'Security',
    description:
      'How ARQ treats your work: projects held on your device, a published security baseline, sandboxed imports by design, and no certifications claimed that have not been earned.',
  },
  render: () => html`
    ${hero({
      heading: 'Your drawings are the asset. Act like it.',
      lede: 'ARQ’s strongest security property is architectural: there is no account system and no ARQ server, so the most common cloud failure modes have nothing to reach. Everything beyond that is a stated baseline rather than a badge.',
    })}
    ${notes([
      {
        title: 'What the current architecture means',
        body: html`
          <p>
            The development build has no account system, no ARQ backend and no sync transport. It
            stores its work on your device, in browser storage or in files you choose. There is no
            server on ARQ's side to breach because there is no server.
          </p>
        `,
      },
      {
        title: 'What has actually been observed',
        body: html`
          <p>
            The repository now includes a headless-browser observation check. It records every
            request attempted while the built application draws a wall, opens the 3D view and
            exercises the file panel, and fails if a request leaves the serving origin. The check
            records attempts rather than blocking them. This is implementation evidence for that
            exercised path, not an approved privacy statement or a promise about every future
            feature. When hosted features arrive, each one needs its own threat-model entry and
            privacy review first.
          </p>
        `,
      },
      {
        title: 'The published baseline',
        body: html`
          <p>
            These commitments are recorded in the repository's security policy and threat model.
            They govern hosted features when those are built:
          </p>
          ${specList([
            {
              term: 'Authorisation',
              detail:
                'Server-side authorisation for any hosted feature; private projects by default.',
            },
            {
              term: 'File handling',
              detail:
                'Short-lived signed URLs, size and complexity limits, sandboxed or isolated import processing.',
            },
            { term: 'Your content', detail: 'No training on private project data by default.' },
            {
              term: 'Accountability',
              detail: 'Audit events for sharing, export and permission changes.',
            },
            {
              term: 'Recovery',
              detail: 'Recovery paths that do not expose private project content.',
            },
            {
              term: 'Supply chain',
              detail:
                'Dependency licence policy enforced in continuous integration with a generated software bill of materials, published on this site under open-source notices.',
            },
          ])}
        `,
      },
      {
        title: 'What ARQ does not claim',
        kind: 'limit',
        body: html`
          <p>
            No compliance certification has been obtained, and this page will not imply one. ARQ
            does not promise zero data loss. What it does instead is build journalling, recovery and
            plain failure messages, and test them. When a claim here can be backed by an audit, the
            audit will be linked from this page.
          </p>
        `,
      },
      {
        title: 'Reporting a vulnerability',
        body: html`
          <p>
            Please do not report unpatched vulnerabilities in public issues. Use a private security
            advisory on the repository, as described in
            <a href="/contact">contact and support</a>.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'Trust is a paper trail.',
      'The threat model, security checklists and file-format documentation are all in the repository.',
      [
        { href: '/docs', label: 'Documentation' },
        { href: '/legal/privacy', label: 'Privacy notice' },
      ],
    )}
  `,
};
