import { describe, expect, it } from 'vitest';
import { readIfcModel } from './ifc-viewer';

function ifcFile(dataLines: string): string {
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('','',(''),(''),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
${dataLines}
ENDSEC;
END-ISO-10303-21;
`;
}

const SAMPLE_IFC = ifcFile(
  `#1=IFCPROJECT('0YvctVUKr0kugbFTf53O9L',$,'Sample Project',$,$,$,$,$,$);
#2=IFCSITE('0YvctVUKr0kugbFTf53O9M',$,'Site',$,$,$,$,$,$,$,$,$,$,$);
#3=IFCBUILDING('0YvctVUKr0kugbFTf53O9N',$,'Building',$,$,$,$,$,$,$,$,$);
#4=IFCBUILDINGSTOREY('0YvctVUKr0kugbFTf53O9O',$,'Level 1',$,$,$,$,$,$,0.);
#5=IFCWALL('0YvctVUKr0kugbFTf53O9P',$,'Wall 1',$,$,$,$,$,$);
#6=IFCWALL('0YvctVUKr0kugbFTf53O9Q',$,'Wall 2',$,$,$,$,$,$);
#7=IFCDOOR('0YvctVUKr0kugbFTf53O9R',$,'Door 1',$,$,$,$,$,$,$,$,$);
#8=IFCFURNISHINGELEMENT('0YvctVUKr0kugbFTf53O9S',$,'Chair',$,$,$,$,$,$);`,
);

describe('readIfcModel', () => {
  it('reads spatial-structure and building-element entities, with names and global IDs', async () => {
    const result = await readIfcModel(new TextEncoder().encode(SAMPLE_IFC));
    expect(result.status).toBe('read');
    if (result.status !== 'read') {
      return;
    }
    const wall1 = result.entities.find((entity) => entity.name === 'Wall 1');
    expect(wall1).toEqual({
      expressId: 5,
      ifcType: 'IFCWALL',
      name: 'Wall 1',
      globalId: '0YvctVUKr0kugbFTf53O9P',
    });
    expect(result.entities.filter((entity) => entity.ifcType === 'IFCWALL')).toHaveLength(2);
    expect(result.entities.some((entity) => entity.name === 'Sample Project')).toBe(true);
  });

  it('reports a correct support report: preserved counts by type, and unsupported lines counted (not silently dropped)', async () => {
    const result = await readIfcModel(new TextEncoder().encode(SAMPLE_IFC));
    expect(result.status).toBe('read');
    if (result.status !== 'read') {
      return;
    }
    expect(result.supportReport.preservedEntityCounts).toEqual({
      IFCPROJECT: 1,
      IFCSITE: 1,
      IFCBUILDING: 1,
      IFCBUILDINGSTOREY: 1,
      IFCWALL: 2,
      IFCDOOR: 1,
    });
    // The sample has 8 total lines; 7 are of a supported type (the IFCFURNISHINGELEMENT is not).
    expect(result.supportReport.unsupportedLineCount).toBe(1);
  });

  // Both tests below give web-ifc's real OpenModel a genuinely malformed
  // file - measured directly against the real library (see ifc-viewer.ts's
  // doc comment), its own internal error handling on invalid input varies
  // widely and can take upward of 30 real seconds before throwing, even
  // though nothing is actually hung - a generous timeout absorbs that
  // measured variance rather than risking an occasional flaky failure.
  it('rejects a file with no valid IFC header rather than throwing', async () => {
    const result = await readIfcModel(new TextEncoder().encode('this is not an ifc file at all'));
    expect(result.status).toBe('rejected');
  }, 60_000);

  it('rejects empty content rather than throwing', async () => {
    const result = await readIfcModel(new Uint8Array(0));
    expect(result.status).toBe('rejected');
  }, 60_000);

  it('rejects a truncated header rather than throwing', async () => {
    const result = await readIfcModel(new TextEncoder().encode('ISO-10303-21;\nHEADER;\n'));
    expect(result.status).toBe('rejected');
  });

  it('produces an empty-but-valid result for a well-formed file with no recognized entities', async () => {
    const result = await readIfcModel(new TextEncoder().encode(ifcFile('')));
    expect(result.status).toBe('read');
    if (result.status === 'read') {
      expect(result.entities).toEqual([]);
      expect(result.supportReport.preservedEntityCounts).toEqual({});
      expect(result.supportReport.unsupportedLineCount).toBe(0);
    }
  });
});
