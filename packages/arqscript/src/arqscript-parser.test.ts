import { describe, expect, it } from 'vitest';
import { parseArqScript } from './arqscript-parser';
import { collectAssumptions, operationTypesUsed } from './arqscript-document';

const SECTION_98_EXAMPLE = `version "0.1"

level "Ground Floor" elevation 0mm

wall "W1" {
  from: point(0mm, 0mm)
  to: point(6000mm, 0mm)
  type: "Exterior 230"
  height: 3000mm
}

door "D1" {
  host: "W1"
  width: 900mm
  height: 2100mm
  offset: 1200mm
}`;

describe('parseArqScript - section 98 example', () => {
  it('parses the exact example script into the expected commands', () => {
    const result = parseArqScript(SECTION_98_EXAMPLE, 'script-1');
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') {
      return;
    }
    expect(result.document.version).toBe('0.1');
    expect(result.document.scriptId).toBe('script-1');
    expect(result.document.commands).toEqual([
      {
        kind: 'level',
        operationType: 'CreateLevel',
        name: 'Ground Floor',
        elevationMm: 0,
        assumptions: [],
      },
      {
        kind: 'wall',
        operationType: 'CreateWall',
        id: 'W1',
        from: { xMm: 0, yMm: 0 },
        to: { xMm: 6000, yMm: 0 },
        wallType: 'Exterior 230',
        heightMm: 3000,
        assumptions: [],
      },
      {
        kind: 'door',
        operationType: 'PlaceDoor',
        id: 'D1',
        hostWallId: 'W1',
        widthMm: 900,
        heightMm: 2100,
        offsetMm: 1200,
        assumptions: [],
      },
    ]);
  });

  it('produces the expected typed-operation names', () => {
    const result = parseArqScript(SECTION_98_EXAMPLE, 'script-1');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(operationTypesUsed(result.document)).toEqual([
        'CreateLevel',
        'CreateWall',
        'PlaceDoor',
      ]);
    }
  });
});

describe('parseArqScript - each v0 statement', () => {
  it('parses units', () => {
    const result = parseArqScript('version "0.1"\nunits metric', 's1');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands[0]).toMatchObject({ kind: 'units', unit: 'metric' });
    }
  });

  it('rejects an invalid units value', () => {
    const result = parseArqScript('version "0.1"\nunits banana', 's1');
    expect(result.status).toBe('rejected');
  });

  it('parses update wall', () => {
    const result = parseArqScript('version "0.1"\nupdate wall "W1" { height: 150mm }', 's1');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands[0]).toMatchObject({
        kind: 'update-wall',
        id: 'W1',
        heightMm: 150,
      });
    }
  });

  it('parses window with all fields', () => {
    const source = `version "0.1"
window "WIN1" {
  host: "W1"
  width: 1200mm
  height: 1400mm
  sill: 900mm
  offset: 1000mm
}`;
    const result = parseArqScript(source, 's1');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands[0]).toMatchObject({
        kind: 'window',
        hostWallId: 'W1',
        widthMm: 1200,
        heightMm: 1400,
        sillHeightMm: 900,
        offsetMm: 1000,
      });
    }
  });

  it('parses room with a boundary array', () => {
    const source = `version "0.1"
room "R1" {
  name: "Kitchen"
  boundary: [point(0mm, 0mm), point(4000mm, 0mm), point(4000mm, 3000mm)]
}`;
    const result = parseArqScript(source, 's1');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands[0]).toMatchObject({
        kind: 'room',
        name: 'Kitchen',
        boundary: [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 0 },
          { xMm: 4000, yMm: 3000 },
        ],
      });
    }
  });

  it('parses dimension', () => {
    const source =
      'version "0.1"\ndimension "DIM1" { from: point(0mm, 0mm) to: point(6000mm, 0mm) }';
    const result = parseArqScript(source, 's1');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands[0]).toMatchObject({ kind: 'dimension', id: 'DIM1' });
    }
  });

  it('parses select by id with multiple ids', () => {
    const result = parseArqScript('version "0.1"\nselect id "W1", "W2"', 's1');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands[0]).toMatchObject({ kind: 'select-id', ids: ['W1', 'W2'] });
    }
  });

  it('parses select by category', () => {
    const result = parseArqScript('version "0.1"\nselect category "Wall"', 's1');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands[0]).toMatchObject({
        kind: 'select-category',
        category: 'Wall',
      });
    }
  });

  it('parses rename', () => {
    const result = parseArqScript('version "0.1"\nrename "R1" to "Living Room"', 's1');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands[0]).toMatchObject({
        kind: 'rename',
        id: 'R1',
        newName: 'Living Room',
      });
    }
  });

  it('parses a version-only document with no statements', () => {
    const result = parseArqScript('version "0.1"', 's1');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      expect(result.document.commands).toEqual([]);
    }
  });
});

describe('parseArqScript - assumptions visible', () => {
  it('records an assumption for an omitted wall type/height, surfaced through collectAssumptions', () => {
    const source = `version "0.1"
wall "W1" {
  from: point(0mm, 0mm)
  to: point(6000mm, 0mm)
}`;
    const result = parseArqScript(source, 's1');
    expect(result.status).toBe('parsed');
    if (result.status === 'parsed') {
      const assumptions = collectAssumptions(result.document);
      expect(assumptions).toHaveLength(2);
      expect(assumptions[0]).toContain('wall "W1"');
    }
  });
});

describe('parseArqScript - safe failure (never throws)', () => {
  it('rejects source missing the version header', () => {
    const result = parseArqScript('level "L1" elevation 0mm', 's1');
    expect(result.status).toBe('rejected');
  });

  it('rejects an unknown statement keyword, with a source position', () => {
    const result = parseArqScript('version "0.1"\nbulldoze "everything"', 's1');
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.position.line).toBe(2);
    }
  });

  it('rejects a wall missing a required field (from)', () => {
    const source = `version "0.1"
wall "W1" {
  to: point(6000mm, 0mm)
}`;
    const result = parseArqScript(source, 's1');
    expect(result.status).toBe('rejected');
  });

  it('rejects a door with an empty host (semantic validation from the AST constructor)', () => {
    const source = `version "0.1"
door "D1" {
  host: ""
  offset: 0mm
}`;
    const result = parseArqScript(source, 's1');
    expect(result.status).toBe('rejected');
  });

  it('rejects an unterminated block', () => {
    const source = `version "0.1"
wall "W1" {
  from: point(0mm, 0mm)`;
    const result = parseArqScript(source, 's1');
    expect(result.status).toBe('rejected');
  });

  it('never throws for a wide variety of malformed inputs', () => {
    const samples = [
      '',
      'garbage',
      'version',
      'version "0.1" wall',
      'version "0.1" #',
      'a'.repeat(2000),
    ];
    for (const sample of samples) {
      const result = parseArqScript(sample, 's1');
      expect(result.status === 'parsed' || result.status === 'rejected').toBe(true);
    }
  });
});
