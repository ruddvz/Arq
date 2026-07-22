import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applySharedSelection } from './shared-selection';

function emptySelection(): { primary: null; secondary: ReadonlySet<string> } {
  return { primary: null, secondary: new Set<string>() };
}

describe('applySharedSelection', () => {
  it('hides an object whose element id is in the hidden set', () => {
    const object = new THREE.Object3D();
    const map = new Map([['wall-1', object]]);
    applySharedSelection(map, new Set(['wall-1']), emptySelection(), new Set());
    expect(object.visible).toBe(false);
  });

  it('shows and tags an unselected, unhidden object as default', () => {
    const object = new THREE.Object3D();
    const map = new Map([['wall-1', object]]);
    applySharedSelection(map, new Set(), emptySelection(), new Set());
    expect(object.visible).toBe(true);
    expect(object.userData.styleToken).toBe('default');
  });

  it('tags the primary-selected object with selected-primary', () => {
    const object = new THREE.Object3D();
    const map = new Map([['wall-1', object]]);
    const selection = { primary: 'wall-1', secondary: new Set<string>() };
    applySharedSelection(map, new Set(), selection, new Set());
    expect(object.userData.styleToken).toBe('selected-primary');
  });

  it('tags a secondary-selected object with selected-secondary', () => {
    const object = new THREE.Object3D();
    const map = new Map([['wall-1', object]]);
    const selection = { primary: 'other', secondary: new Set(['wall-1']) };
    applySharedSelection(map, new Set(), selection, new Set());
    expect(object.userData.styleToken).toBe('selected-secondary');
  });

  it('tags a locked, unselected object with locked', () => {
    const object = new THREE.Object3D();
    const map = new Map([['wall-1', object]]);
    applySharedSelection(map, new Set(), emptySelection(), new Set(['wall-1']));
    expect(object.userData.styleToken).toBe('locked');
  });

  it('applies hidden to every object when an element maps to multiple meshes (opening-panel decomposition, ARQ-125)', () => {
    const pier1 = new THREE.Object3D();
    const pier2 = new THREE.Object3D();
    const header = new THREE.Object3D();
    const map = new Map([['wall-1', [pier1, pier2, header]]]);
    applySharedSelection(map, new Set(['wall-1']), emptySelection(), new Set());
    expect(pier1.visible).toBe(false);
    expect(pier2.visible).toBe(false);
    expect(header.visible).toBe(false);
  });

  it('applies the same styleToken to every object for a multi-mesh element', () => {
    const pier1 = new THREE.Object3D();
    const pier2 = new THREE.Object3D();
    const map = new Map([['wall-1', [pier1, pier2]]]);
    const selection = { primary: 'wall-1', secondary: new Set<string>() };
    applySharedSelection(map, new Set(), selection, new Set());
    expect(pier1.userData.styleToken).toBe('selected-primary');
    expect(pier2.userData.styleToken).toBe('selected-primary');
  });

  it('classifies each element in the map independently', () => {
    const selected = new THREE.Object3D();
    const untouched = new THREE.Object3D();
    const map = new Map([
      ['wall-1', selected],
      ['wall-2', untouched],
    ]);
    const selection = { primary: 'wall-1', secondary: new Set<string>() };
    applySharedSelection(map, new Set(), selection, new Set());
    expect(selected.userData.styleToken).toBe('selected-primary');
    expect(untouched.userData.styleToken).toBe('default');
  });

  it('prioritises selected-primary over hidden being false but locked true (matches resolveStyleToken precedence)', () => {
    const object = new THREE.Object3D();
    const map = new Map([['wall-1', object]]);
    const selection = { primary: 'wall-1', secondary: new Set<string>() };
    applySharedSelection(map, new Set(), selection, new Set(['wall-1']));
    expect(object.userData.styleToken).toBe('selected-primary');
  });
});
