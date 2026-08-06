import type { ComponentProps } from 'react';
import {
  IconActivityHeartbeat,
  IconAlertCircle,
  IconAlertTriangle,
  IconAngle,
  IconArchive,
  IconArmchair,
  IconArrowBarRight,
  IconArrowMerge,
  IconArrowsMove,
  IconArrowsSplit2,
  IconBorderBottom,
  IconBorderOuter,
  IconBox,
  IconBoxMultiple,
  IconBuildingArch,
  IconBuildingCottage,
  IconBuildingSkyscraper,
  IconChecklist,
  IconCopy,
  IconCube,
  IconDoor,
  IconEye,
  IconEyeOff,
  IconFence,
  IconFileDescription,
  IconFileExport,
  IconFilter,
  IconFlipHorizontal,
  IconFocusCentered,
  IconGitCompare,
  IconGrid3x3,
  IconGridDots,
  IconHandFinger,
  IconHistory,
  IconHome,
  IconLayoutAlignLeft,
  IconLayoutGrid,
  IconLine,
  IconLineDashed,
  IconMaximize,
  IconMessageCircle,
  IconNote,
  IconPalette,
  IconPencil,
  IconPerspective,
  IconPointer,
  IconPolygon,
  IconRotate3d,
  IconRotateClockwise,
  IconRuler,
  IconRuler2,
  IconRulerMeasure,
  IconScissors,
  IconSection,
  IconSelect,
  IconSelectAll,
  IconSelector,
  IconSitemap,
  IconSquare,
  IconStack2,
  IconStairs,
  IconTag,
  IconTrash,
  IconTriangleInverted,
  IconWall,
  IconWindow,
  IconWindowMaximize,
  IconZoomIn,
  IconZoomScan,
} from '@tabler/icons-react';

/**
 * ARQ's icon adapter: one semantic name per product concept, each bound to one
 * glyph from one pinned family.
 *
 * The set before this was hand-drawn, and it showed. Nine glyphs were a bare
 * 14x14 rect - one identical, meaningless square standing in for nine different
 * tools - and the rest were uneven in weight, optical size and idiom. Version
 * 13's own icon guidance is the rule followed here: reuse the repository's
 * abstraction first, and where coverage is missing, review and pin *one*
 * coherent library rather than mixing families or inventing amateur artwork.
 *
 * Tabler 3.45.0 is that library, and it is Version 13's own reviewed candidate.
 * It was chosen over Lucide on domain coverage, which is what actually decides
 * it for a BIM product: Tabler draws stairs, a wall, a door, a fence, an angle,
 * a cube and a perspective frustum; Lucide has none of those, so half this list
 * would have fallen back to hand-drawing again.
 *
 * The names on the left are ARQ's, not Tabler's. That indirection is the point:
 * every consumer imports `WallIcon`, so the family can be re-pinned or replaced
 * in this one file without touching a single call site - and no product code
 * grows a dependency on a vendor's naming.
 *
 * Where Tabler has no glyph for a domain concept, the closest honest match is
 * used rather than a hand-drawn one - one family is the rule, and a second
 * family beside the first is what the guidance forbids. Two are compromises
 * worth knowing about: `RoofIcon` is a pitched-roof cottage rather than a roof
 * plane, and `SlabIcon` is a bottom border rather than a floor plate. Both read
 * correctly in context and neither is what an architect would draw.
 *
 * Defaults match the shell's control sizing: 24x24 on a 24 grid, 1.75 stroke to
 * sit with the type rather than shout over it, and `currentColor` so a glyph
 * takes the colour of the control it is in - including under forced colours and
 * increased contrast.
 */

/**
 * Narrowed to what a call site actually sets. Tabler's own prop type forbids an
 * explicit `undefined` under `exactOptionalPropertyTypes`, and spreading a
 * whole `svg` prop bag through it fails for props no icon accepts - so the
 * surface is stated rather than borrowed.
 */
export interface ArqIconProps {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly size?: number | string;
  readonly stroke?: number | string;
  readonly className?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-hidden'?: boolean;
  readonly role?: string;
}

const SIZE = 24;
const STROKE = 1.75;

/**
 * Tabler sizes an icon with `size`, and ignores `width`/`height` entirely.
 * Call sites here ask for `width={16} height={16}`, which is how an SVG is
 * normally sized - so passing those straight through silently produced a 24px
 * glyph everywhere, which is what pushed every tool label out of the 48px rail
 * and left the dock looking like a column of clipped words.
 *
 * Translated here rather than at 70-odd call sites: this file exists precisely
 * so a vendor's prop naming stops at the adapter.
 */
function resolve(
  props: ArqIconProps,
): { size: number | string; stroke: number | string } & Omit<
  ArqIconProps,
  'width' | 'height' | 'size' | 'stroke'
> {
  const { width, height, size, stroke, ...rest } = props;
  return { ...rest, size: size ?? width ?? height ?? SIZE, stroke: stroke ?? STROKE };
}

/** Align */
export function AlignIcon(props: ArqIconProps): JSX.Element {
  return <IconLayoutAlignLeft {...resolve(props)} />;
}

/** Angle */
export function AngleIcon(props: ArqIconProps): JSX.Element {
  return <IconAngle {...resolve(props)} />;
}

/** Area */
export function AreaIcon(props: ArqIconProps): JSX.Element {
  return <IconPolygon {...resolve(props)} />;
}

/** ArqArchive */
export function ArqArchiveIcon(props: ArqIconProps): JSX.Element {
  return <IconArchive {...resolve(props)} />;
}

/** Array */
export function ArrayIcon(props: ArqIconProps): JSX.Element {
  return <IconGridDots {...resolve(props)} />;
}

/** Column */
export function ColumnIcon(props: ArqIconProps): JSX.Element {
  return <IconBuildingArch {...resolve(props)} />;
}

/** Comment */
export function CommentIcon(props: ArqIconProps): JSX.Element {
  return <IconMessageCircle {...resolve(props)} />;
}

/** Copy */
export function CopyIcon(props: ArqIconProps): JSX.Element {
  return <IconCopy {...resolve(props)} />;
}

/** CrossingSelect */
export function CrossingSelectIcon(props: ArqIconProps): JSX.Element {
  return <IconSelectAll {...resolve(props)} />;
}

/** Delete */
export function DeleteIcon(props: ArqIconProps): JSX.Element {
  return <IconTrash {...resolve(props)} />;
}

/** Dimension */
export function DimensionIcon(props: ArqIconProps): JSX.Element {
  return <IconRulerMeasure {...resolve(props)} />;
}

/** Distance */
export function DistanceIcon(props: ArqIconProps): JSX.Element {
  return <IconRuler {...resolve(props)} />;
}

/** Door */
export function DoorIcon(props: ArqIconProps): JSX.Element {
  return <IconDoor {...resolve(props)} />;
}

/** Elevation */
export function ElevationIcon(props: ArqIconProps): JSX.Element {
  return <IconBuildingSkyscraper {...resolve(props)} />;
}

/** Export */
export function ExportIcon(props: ArqIconProps): JSX.Element {
  return <IconFileExport {...resolve(props)} />;
}

/** Extend */
export function ExtendIcon(props: ArqIconProps): JSX.Element {
  return <IconArrowBarRight {...resolve(props)} />;
}

/** Fit */
export function FitIcon(props: ArqIconProps): JSX.Element {
  return <IconMaximize {...resolve(props)} />;
}

/** FurnitureComponent */
export function FurnitureComponentIcon(props: ArqIconProps): JSX.Element {
  return <IconArmchair {...resolve(props)} />;
}

/** Grid */
export function GridIcon(props: ArqIconProps): JSX.Element {
  return <IconGrid3x3 {...resolve(props)} />;
}

/** GroupAnnotate */
export function GroupAnnotateIcon(props: ArqIconProps): JSX.Element {
  return <IconPencil {...resolve(props)} />;
}

/** GroupBuild */
export function GroupBuildIcon(props: ArqIconProps): JSX.Element {
  return <IconHome {...resolve(props)} />;
}

/** GroupDraw */
export function GroupDrawIcon(props: ArqIconProps): JSX.Element {
  return <IconLine {...resolve(props)} />;
}

/** GroupMeasure */
export function GroupMeasureIcon(props: ArqIconProps): JSX.Element {
  return <IconRuler2 {...resolve(props)} />;
}

/** GroupModify */
export function GroupModifyIcon(props: ArqIconProps): JSX.Element {
  return <IconArrowsMove {...resolve(props)} />;
}

/** GroupReview */
export function GroupReviewIcon(props: ArqIconProps): JSX.Element {
  return <IconChecklist {...resolve(props)} />;
}

/** GroupSelect */
export function GroupSelectIcon(props: ArqIconProps): JSX.Element {
  return <IconPointer {...resolve(props)} />;
}

/** GroupView */
export function GroupViewIcon(props: ArqIconProps): JSX.Element {
  return <IconEye {...resolve(props)} />;
}

/** Hide */
export function HideIcon(props: ArqIconProps): JSX.Element {
  return <IconEyeOff {...resolve(props)} />;
}

/** History */
export function HistoryIcon(props: ArqIconProps): JSX.Element {
  return <IconHistory {...resolve(props)} />;
}

/** Inspect */
export function InspectIcon(props: ArqIconProps): JSX.Element {
  return <IconZoomScan {...resolve(props)} />;
}

/** Isolate */
export function IsolateIcon(props: ArqIconProps): JSX.Element {
  return <IconFocusCentered {...resolve(props)} />;
}

/** Issue */
export function IssueIcon(props: ArqIconProps): JSX.Element {
  return <IconAlertTriangle {...resolve(props)} />;
}

/** Join */
export function JoinIcon(props: ArqIconProps): JSX.Element {
  return <IconArrowMerge {...resolve(props)} />;
}

/** Level */
export function LevelIcon(props: ArqIconProps): JSX.Element {
  return <IconStack2 {...resolve(props)} />;
}

/** Mirror */
export function MirrorIcon(props: ArqIconProps): JSX.Element {
  return <IconFlipHorizontal {...resolve(props)} />;
}

/** Model3d */
export function Model3dIcon(props: ArqIconProps): JSX.Element {
  return <IconCube {...resolve(props)} />;
}

/** ModelHealth */
export function ModelHealthIcon(props: ArqIconProps): JSX.Element {
  return <IconActivityHeartbeat {...resolve(props)} />;
}

/** Move */
export function MoveIcon(props: ArqIconProps): JSX.Element {
  return <IconArrowsMove {...resolve(props)} />;
}

/** Offset */
export function OffsetIcon(props: ArqIconProps): JSX.Element {
  return <IconBorderOuter {...resolve(props)} />;
}

/** Opening */
export function OpeningIcon(props: ArqIconProps): JSX.Element {
  return <IconWindowMaximize {...resolve(props)} />;
}

/** Orbit */
export function OrbitIcon(props: ArqIconProps): JSX.Element {
  return <IconRotate3d {...resolve(props)} />;
}

/** Orthographic */
export function OrthographicIcon(props: ArqIconProps): JSX.Element {
  return <IconBox {...resolve(props)} />;
}

/** Pan */
export function PanIcon(props: ArqIconProps): JSX.Element {
  return <IconHandFinger {...resolve(props)} />;
}

/** Perspective */
export function PerspectiveIcon(props: ArqIconProps): JSX.Element {
  return <IconPerspective {...resolve(props)} />;
}

/** Plan */
export function PlanIcon(props: ArqIconProps): JSX.Element {
  return <IconLayoutGrid {...resolve(props)} />;
}

/** Railing */
export function RailingIcon(props: ArqIconProps): JSX.Element {
  return <IconFence {...resolve(props)} />;
}

/** ReferenceLine */
export function ReferenceLineIcon(props: ArqIconProps): JSX.Element {
  return <IconLineDashed {...resolve(props)} />;
}

/** Relationships */
export function RelationshipsIcon(props: ArqIconProps): JSX.Element {
  return <IconSitemap {...resolve(props)} />;
}

/** Revision */
export function RevisionIcon(props: ArqIconProps): JSX.Element {
  return <IconGitCompare {...resolve(props)} />;
}

/** Roof */
export function RoofIcon(props: ArqIconProps): JSX.Element {
  return <IconBuildingCottage {...resolve(props)} />;
}

/** Room */
export function RoomIcon(props: ArqIconProps): JSX.Element {
  return <IconSquare {...resolve(props)} />;
}

/** Rotate */
export function RotateIcon(props: ArqIconProps): JSX.Element {
  return <IconRotateClockwise {...resolve(props)} />;
}

/** SectionBox */
export function SectionBoxIcon(props: ArqIconProps): JSX.Element {
  return <IconBoxMultiple {...resolve(props)} />;
}

/** Section */
export function SectionIcon(props: ArqIconProps): JSX.Element {
  return <IconSection {...resolve(props)} />;
}

/** Select */
export function SelectIcon(props: ArqIconProps): JSX.Element {
  return <IconPointer {...resolve(props)} />;
}

/** SelectSimilar */
export function SelectSimilarIcon(props: ArqIconProps): JSX.Element {
  return <IconSelector {...resolve(props)} />;
}

/** SelectionFilter */
export function SelectionFilterIcon(props: ArqIconProps): JSX.Element {
  return <IconFilter {...resolve(props)} />;
}

/** Sheet */
export function SheetIcon(props: ArqIconProps): JSX.Element {
  return <IconFileDescription {...resolve(props)} />;
}

/** Slab */
export function SlabIcon(props: ArqIconProps): JSX.Element {
  return <IconBorderBottom {...resolve(props)} />;
}

/** Split */
export function SplitIcon(props: ArqIconProps): JSX.Element {
  return <IconArrowsSplit2 {...resolve(props)} />;
}

/** SpotElevation */
export function SpotElevationIcon(props: ArqIconProps): JSX.Element {
  return <IconTriangleInverted {...resolve(props)} />;
}

/** Stair */
export function StairIcon(props: ArqIconProps): JSX.Element {
  return <IconStairs {...resolve(props)} />;
}

/** Tag */
export function TagIcon(props: ArqIconProps): JSX.Element {
  return <IconTag {...resolve(props)} />;
}

/** TextNote */
export function TextNoteIcon(props: ArqIconProps): JSX.Element {
  return <IconNote {...resolve(props)} />;
}

/** Trim */
export function TrimIcon(props: ArqIconProps): JSX.Element {
  return <IconScissors {...resolve(props)} />;
}

/** Unhide */
export function UnhideIcon(props: ArqIconProps): JSX.Element {
  return <IconEye {...resolve(props)} />;
}

/** ViewStyle */
export function ViewStyleIcon(props: ArqIconProps): JSX.Element {
  return <IconPalette {...resolve(props)} />;
}

/** Wall */
export function WallIcon(props: ArqIconProps): JSX.Element {
  return <IconWall {...resolve(props)} />;
}

/** Warning */
export function WarningIcon(props: ArqIconProps): JSX.Element {
  return <IconAlertCircle {...resolve(props)} />;
}

/** Window */
export function WindowIcon(props: ArqIconProps): JSX.Element {
  return <IconWindow {...resolve(props)} />;
}

/** WindowSelect */
export function WindowSelectIcon(props: ArqIconProps): JSX.Element {
  return <IconSelect {...resolve(props)} />;
}

/** Zoom */
export function ZoomIcon(props: ArqIconProps): JSX.Element {
  return <IconZoomIn {...resolve(props)} />;
}
