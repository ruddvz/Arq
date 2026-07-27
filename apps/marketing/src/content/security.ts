import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-010. Security and privacy without overclaiming certification — the SEO
 * brief's prohibited claim for this sheet. Baseline items mirror SECURITY.md.
 */
export const securityPage: Page = {
  meta: {
    id: 'PUB-010',
    route: '/security',
    title: 'Security',
    description:
      'How Arq treats your work: local-first files, a published security baseline, sandboxed imports, no training on private projects by default — and no certifications claimed that have not been earned.',
  },
  render: () => html`
    ${hero({
      heading: 'Your drawings are the asset. Act like it.',
      lede: 'Arq’s strongest security property is architectural: work lives in a file on your device, so the most common cloud failure modes have nothing to reach. Everything beyond that is a stated baseline, not a badge.',
    })}
    ${notes([
      {
        title: 'Local first is a security posture',
        body: html`
          <p>
            The development build stores projects on your device and sends nothing anywhere — there
            is no account system and no server to breach. When hosted features arrive, they extend
            the local file rather than replacing it, and each one lands with its own threat-model
            entry in the repository first.
          </p>
        `,
      },
      {
        title: 'The published baseline',
        body: html`
          <p>
            These commitments are recorded in the repository's security policy and threat model:
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
                'Dependency licence policy enforced in CI with a generated SBOM — published on this site under open-source notices.',
            },
          ])}
        `,
      },
      {
        title: 'What Arq does not claim',
        body: html`
          <p>
            No compliance certification has been obtained, and this page will not imply one. Arq
            does not promise zero data loss — instead it builds journalling, recovery and plain
            failure messages, and tests them. When a claim here can be backed by an audit, the audit
            will be linked from this page.
          </p>
        `,
      },
      {
        title: 'Reporting a vulnerability',
        body: html`
          <p>
            Please do not report unpatched vulnerabilities in public issues. Use a private security
            advisory on the repository, as described in
            <a href="/contact">contact and support</a>. Reports are read by the people who can fix
            them.
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
