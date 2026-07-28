import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-010. Security and privacy without overclaiming certification, which is
 * the SEO brief's prohibited claim for this sheet. Baseline items mirror
 * SECURITY.md.
 *
 * Claim binding: pub-security-network (no-network-data-transfer, UNKNOWN). The
 * previous "sends nothing anywhere" was an absolute transport claim with no
 * network-observation evidence behind it. It is replaced by the architectural
 * facts that are checkable now plus a statement of what is missing.
 */
export const securityPage: Page = {
  meta: {
    id: 'PUB-010',
    route: '/security',
    title: 'Security',
    description:
      'How Arq treats your work: projects held on your device, a published security baseline, sandboxed imports by design, and no certifications claimed that have not been earned.',
  },
  render: () => html`
    ${hero({
      heading: 'Your drawings are the asset. Act like it.',
      lede: 'Arq’s strongest security property is architectural: there is no account system and no Arq server, so the most common cloud failure modes have nothing to reach. Everything beyond that is a stated baseline rather than a badge.',
    })}
    ${notes([
      {
        title: 'What the current architecture means',
        body: html`
          <p>
            The development build has no account system, no Arq backend and no sync transport. It
            stores its work on your device, in browser storage or in files you choose. There is no
            server on Arq's side to breach because there is no server.
          </p>
          <p>
            Arq has not yet published a network-observation test for the build, so this page states
            the architecture rather than making an absolute claim that no byte ever leaves your
            machine. That test and an approved privacy statement are what would let a stronger
            sentence be written here. When hosted features arrive, each one lands with its own
            threat-model entry in the repository first.
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
        title: 'What Arq does not claim',
        body: html`
          <p>
            No compliance certification has been obtained, and this page will not imply one. Arq
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
