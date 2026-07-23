import { describe, expect, it } from 'vitest';
import { proposeWallHeightEdit } from './wall-edit-proposal';
import { operationTypesUsed } from './arqscript-document';

describe('proposeWallHeightEdit', () => {
  it('matches blueprint section 100\'s own example: "Change the selected walls to 150 mm"', () => {
    const proposal = proposeWallHeightEdit(
      'Change the selected walls to 150 mm',
      [
        { wallId: 'W1', currentHeightMm: 2700 },
        { wallId: 'W2', currentHeightMm: 3000 },
      ],
      150,
      'proposal-1',
    );

    expect(proposal.originalRequest).toBe('Change the selected walls to 150 mm');
    expect(proposal.parsedIntent).toBe('Update height to 150mm for walls W1, W2');
    expect(proposal.scriptId).toBe('proposal-1');
    expect(proposal.changes).toEqual([
      { wallId: 'W1', beforeMm: 2700, afterMm: 150 },
      { wallId: 'W2', beforeMm: 3000, afterMm: 150 },
    ]);
  });

  it('produces one previewable UpdateWall operation per target, all sharing one scriptId', () => {
    const proposal = proposeWallHeightEdit(
      'req',
      [
        { wallId: 'W1', currentHeightMm: 2700 },
        { wallId: 'W2', currentHeightMm: 3000 },
      ],
      150,
      'proposal-2',
    );

    expect(proposal.document.commands).toHaveLength(2);
    expect(proposal.document.scriptId).toBe('proposal-2');
    expect(operationTypesUsed(proposal.document)).toEqual(['UpdateWall']);
    expect(proposal.document.commands[0]).toMatchObject({
      kind: 'update-wall',
      id: 'W1',
      heightMm: 150,
    });
  });

  it('has no assumptions, since every command gives an explicit height', () => {
    const proposal = proposeWallHeightEdit(
      'req',
      [{ wallId: 'W1', currentHeightMm: 2700 }],
      150,
      'proposal-3',
    );
    expect(proposal.assumptions).toEqual([]);
  });

  it('has no warnings in this prototype (no validation infrastructure wired in)', () => {
    const proposal = proposeWallHeightEdit(
      'req',
      [{ wallId: 'W1', currentHeightMm: 2700 }],
      150,
      'proposal-4',
    );
    expect(proposal.warnings).toEqual([]);
  });

  it('uses singular wording for a single-wall proposal', () => {
    const proposal = proposeWallHeightEdit(
      'req',
      [{ wallId: 'W1', currentHeightMm: 2700 }],
      150,
      'proposal-5',
    );
    expect(proposal.parsedIntent).toBe('Update height to 150mm for wall W1');
  });

  it('rejects an empty target list - nothing to propose for no selection', () => {
    expect(() => proposeWallHeightEdit('req', [], 150, 'proposal-6')).toThrow(RangeError);
  });

  it('rejects an empty wall id via the underlying createUpdateWallCommand validation', () => {
    expect(() =>
      proposeWallHeightEdit('req', [{ wallId: '', currentHeightMm: 2700 }], 150, 'proposal-7'),
    ).toThrow(RangeError);
  });
});
