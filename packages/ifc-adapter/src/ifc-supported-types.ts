/**
 * ARQ-160: exchange: prototype web-ifc viewer.
 *
 * The IFC entity types this prototype reads: spatial structure (project
 * down to space, matching IFC's standard containment hierarchy) plus the
 * handful of building-element types most relevant to
 * docs/interoperability/FORMAT-SUPPORT-MATRIX.md's stated IFC role
 * ("Viewing and inspection") - not an exhaustive schema reader. Every
 * other IFC type present in a model is still counted (see ifc-viewer.ts's
 * supportReport.unsupportedLineCount) but its content is not read.
 */

import {
  IFCPROJECT,
  IFCSITE,
  IFCBUILDING,
  IFCBUILDINGSTOREY,
  IFCSPACE,
  IFCWALL,
  IFCDOOR,
  IFCWINDOW,
  IFCSLAB,
  IFCCOLUMN,
  IFCBEAM,
  IFCROOF,
} from 'web-ifc';

/** Maps this prototype's supported IFC type name to web-ifc's numeric type constant. */
export const SUPPORTED_IFC_TYPES: Readonly<Record<string, number>> = {
  IFCPROJECT,
  IFCSITE,
  IFCBUILDING,
  IFCBUILDINGSTOREY,
  IFCSPACE,
  IFCWALL,
  IFCDOOR,
  IFCWINDOW,
  IFCSLAB,
  IFCCOLUMN,
  IFCBEAM,
  IFCROOF,
};
