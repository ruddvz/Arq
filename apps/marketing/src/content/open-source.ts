import { hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';
import { groupByLicence, type Sbom } from '../open-source-data.js';

/**
 * PUB-017. Publish generated third-party notices. This is the one generated
 * sheet in the set: its table comes from the same SBOM the CI licence gate
 * produces (scripts/check-dependency-licences.mjs), so the notices can never
 * drift from what is actually installed.
 */
export function openSourcePage(sbom: Sbom): Page {
  const groups = groupByLicence(sbom);
  return {
    meta: {
      id: 'PUB-017',
      route: '/legal/open-source',
      title: 'Open-source notices',
      documentTitle: 'Open-source notices — Arq',
      description:
        'Third-party open-source software used to build Arq, generated from the repository’s software bill of materials and grouped by licence.',
    },
    render: () => html`
      ${hero({
        heading: 'Software Arq is built with.',
        lede: 'Arq depends on open-source software, and says so precisely. This list is generated from the repository’s software bill of materials — the same data the continuous-integration licence gate enforces.',
      })}
      ${notes([
        {
          title: 'About this list',
          body: html`
            <p>
              ${sbom.packageCount} packages, generated ${sbom.generatedAt.slice(0, 10)}. Every
              licence below is on the project's published allow-list or reviewed-exceptions list
              (docs/product/DEPENDENCY-AND-LICENCE-POLICY.md); a dependency outside both fails the
              build. Self-hosted fonts (Plus Jakarta Sans, JetBrains Mono) are used under the SIL
              Open Font License 1.1.
            </p>
          `,
        },
      ])}
      <div class="measure">
        ${groups.map(
          (group) => html`
            <section class="note">
              <h2>
                <span class="note-number" aria-hidden="true">${group.packages.length}</span>
                ${group.licence}
              </h2>
              <div class="note-body">
                <ul class="notice-list">
                  ${group.packages.map(
                    (pkg) => html`<li><code>${pkg.name}@${pkg.version}</code></li>`,
                  )}
                </ul>
              </div>
            </section>
          `,
        )}
      </div>
    `,
  };
}
