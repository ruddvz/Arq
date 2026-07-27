import { ctaBand, dataTable, hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-007. Publish format support accurately. The table mirrors
 * docs/interoperability/FORMAT-SUPPORT-MATRIX.md row for row — including the
 * uncomfortable rows. The SEO brief prohibits "lossless exchange".
 */
export const interoperabilityPage: Page = {
  meta: {
    id: 'PUB-007',
    route: '/interoperability',
    title: 'Interoperability',
    description:
      'Arq format support, published accurately: .arq native, PDF and image underlay, vector PDF export, DXF exchange and IFC viewing on the roadmap — with DWG and RVT honestly not committed.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'PUB-007 · interoperability',
      heading: 'Format support, stated exactly.',
      lede: 'Exchange is where CAD marketing usually lies. This table is mirrored from the repository’s format support matrix, and the site’s tests fail if a claim here outruns it.',
    })}
    ${notes([
      {
        title: 'The support matrix',
        body: html`
          ${dataTable(
            'Mirrors docs/interoperability/FORMAT-SUPPORT-MATRIX.md',
            ['Format', 'First role', 'Status'],
            [
              ['.arq', 'Native archive', 'Release 1'],
              ['PNG / JPEG', 'Underlay', 'Release 1'],
              ['PDF', 'Underlay and vector export', 'Release 1'],
              ['DXF', 'Linework exchange', 'Release 2'],
              ['IFC', 'Viewing and inspection', 'Release 2'],
              ['glTF / GLB', 'Visual exchange', 'Later'],
              ['BCF', 'Issue exchange', 'Later'],
              ['STEP', 'Selected solids', 'Later'],
              ['DWG', 'Licensed conversion only if justified', 'Not committed'],
              ['RVT', 'Connector or external workflow only', 'Not committed'],
            ],
          )}
        `,
      },
      {
        title: 'How to read it',
        body: html`
          <p>
            “Exchange” never means lossless. Every import in Arq produces an import report: what
            came in, what was converted, what was unsupported and why. Exports state what they
            contain. If a consultant asks “will it round-trip?”, the honest answer is that nothing
            round-trips perfectly between BIM tools, and Arq will show you the differences instead
            of hiding them.
          </p>
        `,
      },
      {
        title: 'What already parses',
        body: html`
          <p>
            In the development build, the DXF tokenizer and parser, IFC reading through web-ifc, PDF
            vector export and the import pipeline (detection, policy, staging) exist as tested
            libraries — several hundred tests across them. What remains is wiring them into the
            product surface end to end, tracked openly in the
            <a href="/changelog">changelog</a>.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'Your archive should outlive your software.',
      'The native format is documented SQLite, and the plan for every exchange format is public in the repository.',
      [
        { href: '/security', label: 'How files are treated' },
        { href: '/docs', label: 'Documentation' },
      ],
    )}
  `,
};
