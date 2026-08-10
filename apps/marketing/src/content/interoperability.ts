import { ctaBand, dataTable, hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-007. Publish format support accurately. Format, first role and scope
 * mirror docs/interoperability/FORMAT-SUPPORT-MATRIX.md row for row,
 * including the uncomfortable rows. The "Library adapter" column is not in
 * that document; it is read directly from the code registries
 * (packages/file-ingress/src/formats.ts and
 * workers/import-export-worker/src/default-registry.ts), so it can name only
 * an import adapter that is actually registered, never a product workflow.
 * The SEO brief prohibits "lossless exchange".
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
    family: 'capability',
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
            The scope column is release scope. It states when a format is planned to become usable
            in the product, not what the current development build can open today. The library
            adapter column is a separate, narrower fact: whether an import adapter for that format
            is registered in the repository's code today. A registered adapter is tested library
            code, not a product feature; see "What already parses" below.
          </p>
          ${dataTable(
            'Format and scope mirror docs/interoperability/FORMAT-SUPPORT-MATRIX.md; library adapter is read from the code registry',
            ['Format', 'First role', 'Library adapter', 'Scope'],
            [
              ['.arq', 'Native archive', 'Native format, not an adapter', 'Release 1'],
              ['PNG / JPEG', 'Underlay', 'Yes: UnderlayAdapter (read only)', 'Release 1'],
              [
                'PDF',
                'Underlay and vector export',
                'Yes: UnderlayAdapter (read only)',
                'Release 1',
              ],
              ['DXF', 'Linework exchange', 'Yes: DxfIngressAdapter (read only)', 'Release 2'],
              ['IFC', 'Viewing and inspection', 'Yes: IfcIngressAdapter (read only)', 'Release 2'],
              ['glTF / GLB', 'Visual exchange', 'No', 'Later'],
              ['BCF', 'Issue exchange', 'No', 'Later'],
              ['STEP', 'Selected solids', 'No', 'Later'],
              ['DWG', 'Licensed conversion only if justified', 'No', 'Not committed'],
              ['RVT', 'Connector or external workflow only', 'No', 'Not committed'],
            ],
          )}
        `,
      },
      {
        title: 'How ARQ will describe a result',
        body: html`
          <p>
            Exchange is never a promise that both files mean the same thing. ARQ reports each piece
            of content with one of eleven results, and an import or export report is required to use
            these words rather than a summary adjective:
          </p>
          <p>
            <strong>Preserved</strong> (meaning and value retained),
            <strong>Converted</strong> (mapped into a different but equivalent ARQ representation),
            <strong>Approximated</strong> (representation changed with known, measurable loss),
            <strong>Flattened</strong> (structured or semantic content reduced to something
            simpler), <strong>Omitted</strong> (intentionally not included in the output),
            <strong>Unsupported</strong> (no supported mapping exists),
            <strong>Retained as opaque data</strong> (kept without ARQ interpreting its semantics),
            <strong>Failed</strong> (processing did not complete for the item),
            <strong>Quarantined</strong> (kept in the project with its source payload intact and not
            converted; distinct from omitted, which is not kept, and from unsupported, which
            describes the mapping rather than what happened to the data),
            <strong>Substituted</strong> (written to the target format as a different concept
            because the target has no equivalent; a room written as a closed polyline is
            substituted, not converted) and <strong>Simplified</strong> (written with detail the
            target format cannot express dropped; distinct from approximated, where a value changed,
            since here the value is exact and the structure is poorer).
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
