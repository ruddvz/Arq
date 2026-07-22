/**
 * ARQ-130: build identity property group.
 *
 * docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md section
 * 12 ("Right inspector") lists "Identity" as the first inspector group,
 * under rules that apply to every group alike: "inherited values show
 * their source; overridden values show an override marker; calculated
 * values are read-only unless a controlling parameter exists." This
 * module is the read-model that satisfies those rules for the four
 * identity-level facts section 33 ("IDs") requires stay distinct and
 * never conflated: the element's own opaque id, its display name,
 * its external IFC GlobalId, and its external DXF handle.
 *
 * Deliberately generic over category rather than one function per
 * element kind: element.ts (ARQ-063) already established that Wall/
 * Opening/Room do not share a common base shape (Opening has no
 * levelId; Room has no typeId), so `IdentitySource` is the minimal
 * common descriptor a caller builds from whatever concrete element it
 * has, rather than this module importing Wall/Door/Room/etc. directly -
 * consistent with this issue's own non-goal "do not couple project
 * semantics to renderer or external-format classes."
 *
 * `name` is the one field with a real inherited/overridden question,
 * matching section 35 ("Type and instance") exactly: when the element
 * has a type, its name is Inherited from the type's name unless a
 * `nameOverride` is given, in which case it is Overridden. Room has no
 * type at all (room.ts, ARQ-110's own doc comment: "Room has no
 * RoomType"), so a typeless element's own name has no inheritance
 * question to resolve - it is Calculated, meaning here "not read
 * through a type; the instance is the only source", which is why a
 * typeless element's `nameOverride` is fed to `calculatedProperty`
 * rather than `inheritedProperty`/`overriddenProperty` (both of which
 * require a real sourceTypeId).
 *
 * `id`/`category` are always Calculated: opaque and read-only, per
 * section 33's "IDs are opaque; display names are not IDs."
 * `levelId`/`ifcGlobalId`/`dxfHandle` are Missing when the source
 * element does not have one (an Opening has no levelId of its own;
 * most elements are not imported) rather than Invalid - their absence
 * is an expected, non-erroneous case, not a malformed value.
 */

import {
  calculatedProperty,
  importedProperty,
  inheritedProperty,
  missingProperty,
  overriddenProperty,
  type PropertyState,
} from './property-state';

export interface IdentitySource {
  readonly id: string;
  readonly category: string;
  readonly levelId?: string;
  /** Present only for element kinds that have a reusable type definition (e.g. Wall -> WallType). */
  readonly type?: { readonly id: string; readonly name: string };
  /** An instance-level name distinct from the type's name - for typed elements this is an override; for typeless elements (Room) it is the element's only name. */
  readonly nameOverride?: string;
  readonly ifcGlobalId?: string;
  readonly dxfHandle?: string;
}

export interface IdentityPropertyGroup {
  readonly id: PropertyState<string>;
  readonly category: PropertyState<string>;
  readonly name: PropertyState<string>;
  readonly levelId: PropertyState<string>;
  readonly ifcGlobalId: PropertyState<string>;
  readonly dxfHandle: PropertyState<string>;
}

export function buildIdentityPropertyGroup(source: IdentitySource): IdentityPropertyGroup {
  return {
    id: calculatedProperty(source.id),
    category: calculatedProperty(source.category),
    name: resolveIdentityName(source),
    levelId: source.levelId === undefined ? missingProperty() : calculatedProperty(source.levelId),
    ifcGlobalId:
      source.ifcGlobalId === undefined ? missingProperty() : importedProperty(source.ifcGlobalId, 'ifc'),
    dxfHandle: source.dxfHandle === undefined ? missingProperty() : importedProperty(source.dxfHandle, 'dxf'),
  };
}

function resolveIdentityName(source: IdentitySource): PropertyState<string> {
  if (source.type !== undefined) {
    return source.nameOverride === undefined
      ? inheritedProperty(source.type.name, source.type.id)
      : overriddenProperty(source.nameOverride, source.type.id);
  }
  return source.nameOverride === undefined ? missingProperty() : calculatedProperty(source.nameOverride);
}
