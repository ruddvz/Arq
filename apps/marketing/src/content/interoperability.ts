import { ctaBand, dataTable, hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-007. Publish format support accurately. The table mirrors
 * docs/interoperability/FORMAT-SUPPORT-MATRIX.md row for row, including the
 * uncomfortable rows. The SEO brief prohibits "lossless exchange".
 *
 * Claim bindings: pub-interop-end-to-end (current-import-export-e2e,
 * LIBRARY_ONLY) and pub-interop-fidelity (lossless-exchange, PROHIBITED).
 * Fidelity is described with ARQ's own result vocabulary from
 * docs/product/voice/format-language-map.json rather than a universal claim
 * about what every BIM tool can or cannot do.
 */
export const interoperabilityPage: Page = {
  meta: {
    id: 'PUB-007',
    route: '/interoperability',
    title: 'Interoperability',
    description:
      'ARQ format support, published as scope: .arq native, PDF and image underlay, vector PDF export, DXF exchange and IFC viewing, with DWG and RVT not committed. Adapters are tested as libraries.',
  },
  render: () => html`
    ${hero({
      heading: 'Format support, stated exactly.',
      lede: 'This table is mirrored from the repository’s format support matrix, and the site’s tests fail if a claim here outruns it.',
    })}
    ${notes([
      {
        title: 'The support matrix',
        body: html`
          <p>
            The status column is release scope. It states when a format is planned to become usable
            in the product, not what the current development build can open today.
          </p>
          ${dataTable(
            'Mirrors docs/interoperability/FORMAT-SUPPORT-MATRIX.md',
            ['Format', 'First role', 'Scope'],
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
        title: 'How ARQ will describe a result',
        body: html`
          <p>
            Exchange is never a promise that both files mean the same thing. ARQ reports each piece
            of content with one of eight results, and an import or export report is required to use
            these words rather than a summary adjective:
          </p>
          <p>
            <strong>Preserved</strong> (carried across unchanged),
            <strong>Converted</strong> (represented as a different but equivalent ARQ element),
            <strong>Approximated</strong> (geometry simplified within a stated tolerance),
            <strong>Flattened</strong> (structure or hierarchy lost),
            <strong>Omitted</strong> (deliberately not carried across),
            <strong>Unsupported</strong> (ARQ has no representation for it),
            <strong>Retained as opaque data</strong> (kept byte for byte without interpretation) and
            <strong>Failed</strong> (the operation did not complete).
          </p>
        `,
      },
      {
        title: 'What already parses',
        body: html`
          <p>
            The DXF tokenizer and parser, IFC reading through web-ifc, PDF vector export and the
            import pipeline stages (detection, policy, staging) exist in the repository as tested
            libraries. That is a library boundary, not a workflow: no import or export path is
            reachable from the product today, and the import worker is not constructed by the web
            app.
          </p>
          <p>
            Wiring those libraries into a product surface, with the report described above, is what
            turns them into a feature. The <a href="/changelog">changelog</a> tracks that work.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'The format is documented before the features are built.',
      'The native format is documented SQLite, and the plan for every exchange format is public in the repository.',
      [
        { href: '/security', label: 'How files are treated' },
        { href: '/docs', label: 'Documentation' },
      ],
    )}
  `,
};
