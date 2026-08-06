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
  IconBorderOuter,
  IconBox,
  IconBoxMultiple,
  IconBuildingArch,
  IconBuildingSkyscraper,
  IconChecklist,
  IconContrast,
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
  IconHomeRibbon,
  IconLayersSubtract,
  IconLayoutAlignLeft,
  IconLayoutDistributeHorizontal,
  IconLayoutGrid,
  IconLine,
  IconLineDashed,
  IconMaximize,
  IconMessageCircle,
  IconPencil,
  IconPerspective,
  IconPointer,
  IconRotate3d,
  IconRotateClockwise,
  IconRuler,
  IconRuler2,
  IconRulerMeasure,
  IconScissors,
  IconSelect,
  IconSelectAll,
  IconSelector,
  IconSquare,
  IconStack2,
  IconStairs,
  IconTag,
  IconTopologyStar3,
  IconTrash,
  IconTriangleInverted,
  IconTypography,
  IconVectorBezier2,
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

/** Align */
export function AlignIcon(props: ArqIconProps): JSX.Element {
  return <IconLayoutAlignLeft size={SIZE} stroke={STROKE} {...props} />;
}

/** Angle */
export function AngleIcon(props: ArqIconProps): JSX.Element {
  return <IconAngle size={SIZE} stroke={STROKE} {...props} />;
}

/** Area */
export function AreaIcon(props: ArqIconProps): JSX.Element {
  return <IconVectorBezier2 size={SIZE} stroke={STROKE} {...props} />;
}

/** ArqArchive */
export function ArqArchiveIcon(props: ArqIconProps): JSX.Element {
  return <IconArchive size={SIZE} stroke={STROKE} {...props} />;
}

/** Array */
export function ArrayIcon(props: ArqIconProps): JSX.Element {
  return <IconGridDots size={SIZE} stroke={STROKE} {...props} />;
}

/** Column */
export function ColumnIcon(props: ArqIconProps): JSX.Element {
  return <IconBuildingArch size={SIZE} stroke={STROKE} {...props} />;
}

/** Comment */
export function CommentIcon(props: ArqIconProps): JSX.Element {
  return <IconMessageCircle size={SIZE} stroke={STROKE} {...props} />;
}

/** Copy */
export function CopyIcon(props: ArqIconProps): JSX.Element {
  return <IconCopy size={SIZE} stroke={STROKE} {...props} />;
}

/** CrossingSelect */
export function CrossingSelectIcon(props: ArqIconProps): JSX.Element {
  return <IconSelectAll size={SIZE} stroke={STROKE} {...props} />;
}

/** Delete */
export function DeleteIcon(props: ArqIconProps): JSX.Element {
  return <IconTrash size={SIZE} stroke={STROKE} {...props} />;
}

/** Dimension */
export function DimensionIcon(props: ArqIconProps): JSX.Element {
  return <IconRulerMeasure size={SIZE} stroke={STROKE} {...props} />;
}

/** Distance */
export function DistanceIcon(props: ArqIconProps): JSX.Element {
  return <IconRuler size={SIZE} stroke={STROKE} {...props} />;
}

/** Door */
export function DoorIcon(props: ArqIconProps): JSX.Element {
  return <IconDoor size={SIZE} stroke={STROKE} {...props} />;
}

/** Elevation */
export function ElevationIcon(props: ArqIconProps): JSX.Element {
  return <IconBuildingSkyscraper size={SIZE} stroke={STROKE} {...props} />;
}

/** Export */
export function ExportIcon(props: ArqIconProps): JSX.Element {
  return <IconFileExport size={SIZE} stroke={STROKE} {...props} />;
}

/** Extend */
export function ExtendIcon(props: ArqIconProps): JSX.Element {
  return <IconArrowBarRight size={SIZE} stroke={STROKE} {...props} />;
}

/** Fit */
export function FitIcon(props: ArqIconProps): JSX.Element {
  return <IconMaximize size={SIZE} stroke={STROKE} {...props} />;
}

/** FurnitureComponent */
export function FurnitureComponentIcon(props: ArqIconProps): JSX.Element {
  return <IconArmchair size={SIZE} stroke={STROKE} {...props} />;
}

/** Grid */
export function GridIcon(props: ArqIconProps): JSX.Element {
  return <IconGrid3x3 size={SIZE} stroke={STROKE} {...props} />;
}

/** GroupAnnotate */
export function GroupAnnotateIcon(props: ArqIconProps): JSX.Element {
  return <IconPencil size={SIZE} stroke={STROKE} {...props} />;
}

/** GroupBuild */
export function GroupBuildIcon(props: ArqIconProps): JSX.Element {
  return <IconHome size={SIZE} stroke={STROKE} {...props} />;
}

/** GroupDraw */
export function GroupDrawIcon(props: ArqIconProps): JSX.Element {
  return <IconLine size={SIZE} stroke={STROKE} {...props} />;
}

/** GroupMeasure */
export function GroupMeasureIcon(props: ArqIconProps): JSX.Element {
  return <IconRuler2 size={SIZE} stroke={STROKE} {...props} />;
}

/** GroupModify */
export function GroupModifyIcon(props: ArqIconProps): JSX.Element {
  return <IconArrowsMove size={SIZE} stroke={STROKE} {...props} />;
}

/** GroupReview */
export function GroupReviewIcon(props: ArqIconProps): JSX.Element {
  return <IconChecklist size={SIZE} stroke={STROKE} {...props} />;
}

/** GroupSelect */
export function GroupSelectIcon(props: ArqIconProps): JSX.Element {
  return <IconPointer size={SIZE} stroke={STROKE} {...props} />;
}

/** GroupView */
export function GroupViewIcon(props: ArqIconProps): JSX.Element {
  return <IconEye size={SIZE} stroke={STROKE} {...props} />;
}

/** Hide */
export function HideIcon(props: ArqIconProps): JSX.Element {
  return <IconEyeOff size={SIZE} stroke={STROKE} {...props} />;
}

/** History */
export function HistoryIcon(props: ArqIconProps): JSX.Element {
  return <IconHistory size={SIZE} stroke={STROKE} {...props} />;
}

/** Inspect */
export function InspectIcon(props: ArqIconProps): JSX.Element {
  return <IconZoomScan size={SIZE} stroke={STROKE} {...props} />;
}

/** Isolate */
export function IsolateIcon(props: ArqIconProps): JSX.Element {
  return <IconFocusCentered size={SIZE} stroke={STROKE} {...props} />;
}

/** Issue */
export function IssueIcon(props: ArqIconProps): JSX.Element {
  return <IconAlertTriangle size={SIZE} stroke={STROKE} {...props} />;
}

/** Join */
export function JoinIcon(props: ArqIconProps): JSX.Element {
  return <IconArrowMerge size={SIZE} stroke={STROKE} {...props} />;
}

/** Level */
export function LevelIcon(props: ArqIconProps): JSX.Element {
  return <IconStack2 size={SIZE} stroke={STROKE} {...props} />;
}

/** Mirror */
export function MirrorIcon(props: ArqIconProps): JSX.Element {
  return <IconFlipHorizontal size={SIZE} stroke={STROKE} {...props} />;
}

/** Model3d */
export function Model3dIcon(props: ArqIconProps): JSX.Element {
  return <IconCube size={SIZE} stroke={STROKE} {...props} />;
}

/** ModelHealth */
export function ModelHealthIcon(props: ArqIconProps): JSX.Element {
  return <IconActivityHeartbeat size={SIZE} stroke={STROKE} {...props} />;
}

/** Move */
export function MoveIcon(props: ArqIconProps): JSX.Element {
  return <IconArrowsMove size={SIZE} stroke={STROKE} {...props} />;
}

/** Offset */
export function OffsetIcon(props: ArqIconProps): JSX.Element {
  return <IconBorderOuter size={SIZE} stroke={STROKE} {...props} />;
}

/** Opening */
export function OpeningIcon(props: ArqIconProps): JSX.Element {
  return <IconWindowMaximize size={SIZE} stroke={STROKE} {...props} />;
}

/** Orbit */
export function OrbitIcon(props: ArqIconProps): JSX.Element {
  return <IconRotate3d size={SIZE} stroke={STROKE} {...props} />;
}

/** Orthographic */
export function OrthographicIcon(props: ArqIconProps): JSX.Element {
  return <IconBox size={SIZE} stroke={STROKE} {...props} />;
}

/** Pan */
export function PanIcon(props: ArqIconProps): JSX.Element {
  return <IconHandFinger size={SIZE} stroke={STROKE} {...props} />;
}

/** Perspective */
export function PerspectiveIcon(props: ArqIconProps): JSX.Element {
  return <IconPerspective size={SIZE} stroke={STROKE} {...props} />;
}

/** Plan */
export function PlanIcon(props: ArqIconProps): JSX.Element {
  return <IconLayoutGrid size={SIZE} stroke={STROKE} {...props} />;
}

/** Railing */
export function RailingIcon(props: ArqIconProps): JSX.Element {
  return <IconFence size={SIZE} stroke={STROKE} {...props} />;
}

/** ReferenceLine */
export function ReferenceLineIcon(props: ArqIconProps): JSX.Element {
  return <IconLineDashed size={SIZE} stroke={STROKE} {...props} />;
}

/** Relationships */
export function RelationshipsIcon(props: ArqIconProps): JSX.Element {
  return <IconTopologyStar3 size={SIZE} stroke={STROKE} {...props} />;
}

/** Revision */
export function RevisionIcon(props: ArqIconProps): JSX.Element {
  return <IconGitCompare size={SIZE} stroke={STROKE} {...props} />;
}

/** Roof */
export function RoofIcon(props: ArqIconProps): JSX.Element {
  return <IconHomeRibbon size={SIZE} stroke={STROKE} {...props} />;
}

/** Room */
export function RoomIcon(props: ArqIconProps): JSX.Element {
  return <IconSquare size={SIZE} stroke={STROKE} {...props} />;
}

/** Rotate */
export function RotateIcon(props: ArqIconProps): JSX.Element {
  return <IconRotateClockwise size={SIZE} stroke={STROKE} {...props} />;
}

/** SectionBox */
export function SectionBoxIcon(props: ArqIconProps): JSX.Element {
  return <IconBoxMultiple size={SIZE} stroke={STROKE} {...props} />;
}

/** Section */
export function SectionIcon(props: ArqIconProps): JSX.Element {
  return <IconLayoutDistributeHorizontal size={SIZE} stroke={STROKE} {...props} />;
}

/** Select */
export function SelectIcon(props: ArqIconProps): JSX.Element {
  return <IconPointer size={SIZE} stroke={STROKE} {...props} />;
}

/** SelectSimilar */
export function SelectSimilarIcon(props: ArqIconProps): JSX.Element {
  return <IconSelector size={SIZE} stroke={STROKE} {...props} />;
}

/** SelectionFilter */
export function SelectionFilterIcon(props: ArqIconProps): JSX.Element {
  return <IconFilter size={SIZE} stroke={STROKE} {...props} />;
}

/** Sheet */
export function SheetIcon(props: ArqIconProps): JSX.Element {
  return <IconFileDescription size={SIZE} stroke={STROKE} {...props} />;
}

/** Slab */
export function SlabIcon(props: ArqIconProps): JSX.Element {
  return <IconLayersSubtract size={SIZE} stroke={STROKE} {...props} />;
}

/** Split */
export function SplitIcon(props: ArqIconProps): JSX.Element {
  return <IconArrowsSplit2 size={SIZE} stroke={STROKE} {...props} />;
}

/** SpotElevation */
export function SpotElevationIcon(props: ArqIconProps): JSX.Element {
  return <IconTriangleInverted size={SIZE} stroke={STROKE} {...props} />;
}

/** Stair */
export function StairIcon(props: ArqIconProps): JSX.Element {
  return <IconStairs size={SIZE} stroke={STROKE} {...props} />;
}

/** Tag */
export function TagIcon(props: ArqIconProps): JSX.Element {
  return <IconTag size={SIZE} stroke={STROKE} {...props} />;
}

/** TextNote */
export function TextNoteIcon(props: ArqIconProps): JSX.Element {
  return <IconTypography size={SIZE} stroke={STROKE} {...props} />;
}

/** Trim */
export function TrimIcon(props: ArqIconProps): JSX.Element {
  return <IconScissors size={SIZE} stroke={STROKE} {...props} />;
}

/** Unhide */
export function UnhideIcon(props: ArqIconProps): JSX.Element {
  return <IconEye size={SIZE} stroke={STROKE} {...props} />;
}

/** ViewStyle */
export function ViewStyleIcon(props: ArqIconProps): JSX.Element {
  return <IconContrast size={SIZE} stroke={STROKE} {...props} />;
}

/** Wall */
export function WallIcon(props: ArqIconProps): JSX.Element {
  return <IconWall size={SIZE} stroke={STROKE} {...props} />;
}

/** Warning */
export function WarningIcon(props: ArqIconProps): JSX.Element {
  return <IconAlertCircle size={SIZE} stroke={STROKE} {...props} />;
}

/** Window */
export function WindowIcon(props: ArqIconProps): JSX.Element {
  return <IconWindow size={SIZE} stroke={STROKE} {...props} />;
}

/** WindowSelect */
export function WindowSelectIcon(props: ArqIconProps): JSX.Element {
  return <IconSelect size={SIZE} stroke={STROKE} {...props} />;
}

/** Zoom */
export function ZoomIcon(props: ArqIconProps): JSX.Element {
  return <IconZoomIn size={SIZE} stroke={STROKE} {...props} />;
}
