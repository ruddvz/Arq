import type { ReactNode } from 'react';
import {
  AlignIcon,
  CommentIcon,
  CopyIcon,
  CrossingSelectIcon,
  DimensionIcon,
  DoorIcon,
  ElevationIcon,
  ExtendIcon,
  FitIcon,
  GridIcon,
  JoinIcon,
  MirrorIcon,
  ModelHealthIcon,
  MoveIcon,
  OffsetIcon,
  OrbitIcon,
  OrthographicIcon,
  PanIcon,
  PerspectiveIcon,
  RevisionIcon,
  RoomIcon,
  RotateIcon,
  SectionIcon,
  SelectIcon,
  SplitIcon,
  TextNoteIcon,
  TrimIcon,
  WallIcon,
  WindowIcon,
  WindowSelectIcon,
  GroupSelectIcon,
  GroupDrawIcon,
  GroupBuildIcon,
  GroupModifyIcon,
  GroupAnnotateIcon,
  GroupMeasureIcon,
  GroupViewIcon,
  GroupReviewIcon,
  AngleIcon,
  AreaIcon,
  ArrayIcon,
  ColumnIcon,
  DeleteIcon,
  DistanceIcon,
  FurnitureComponentIcon,
  HideIcon,
  IsolateIcon,
  IssueIcon,
  OpeningIcon,
  RailingIcon,
  ReferenceLineIcon,
  RoofIcon,
  SectionBoxIcon,
  SelectSimilarIcon,
  SelectionFilterIcon,
  SlabIcon,
  SpotElevationIcon,
  StairIcon,
  TagIcon,
  UnhideIcon,
  ViewStyleIcon,
  ZoomIcon,
  InspectIcon,
  PlanIcon,
  SheetIcon,
  ArqArchiveIcon,
  ExportIcon,
  HistoryIcon,
} from '@arq/icons';

/**
 * Registry tool id -> the icon @arq/icons actually ships for it.
 *
 * Partial, and the partiality is the point. `design/icons/svg/` holds 40
 * glyphs; `workspace-tool-registry.json` describes 54 tools. The 24 without
 * one are listed in `TOOLS_AWAITING_ICON` below rather than being filled with
 * a borrowed or approximated vector - doc 48's note is that an automatically
 * generated placeholder is not ARQ artwork, and the imported Font Awesome set
 * the Version 12 package ships would put a second icon family on the same
 * rail, which its own icon rules forbid.
 *
 * A tool with no glyph still renders its full text label, so nothing is
 * unlabelled or mystery-iconed; the rail is simply less even until the
 * artwork lands.
 */
export const TOOL_ICONS: Readonly<Record<string, ReactNode>> = {
  select: <SelectIcon width={16} height={16} />,
  'window-select': <WindowSelectIcon width={16} height={16} />,
  'crossing-select': <CrossingSelectIcon width={16} height={16} />,
  wall: <WallIcon width={16} height={16} />,
  grid: <GridIcon width={16} height={16} />,
  door: <DoorIcon width={16} height={16} />,
  window: <WindowIcon width={16} height={16} />,
  'room-boundary': <RoomIcon width={16} height={16} />,
  move: <MoveIcon width={16} height={16} />,
  copy: <CopyIcon width={16} height={16} />,
  rotate: <RotateIcon width={16} height={16} />,
  mirror: <MirrorIcon width={16} height={16} />,
  offset: <OffsetIcon width={16} height={16} />,
  align: <AlignIcon width={16} height={16} />,
  trim: <TrimIcon width={16} height={16} />,
  extend: <ExtendIcon width={16} height={16} />,
  join: <JoinIcon width={16} height={16} />,
  split: <SplitIcon width={16} height={16} />,
  dimension: <DimensionIcon width={16} height={16} />,
  'text-note': <TextNoteIcon width={16} height={16} />,
  'section-marker': <SectionIcon width={16} height={16} />,
  'elevation-marker': <ElevationIcon width={16} height={16} />,
  pan: <PanIcon width={16} height={16} />,
  orbit: <OrbitIcon width={16} height={16} />,
  fit: <FitIcon width={16} height={16} />,
  perspective: <PerspectiveIcon width={16} height={16} />,
  orthographic: <OrthographicIcon width={16} height={16} />,
  comment: <CommentIcon width={16} height={16} />,
  'model-health': <ModelHealthIcon width={16} height={16} />,
  'compare-revisions': <RevisionIcon width={16} height={16} />,
  angle: <AngleIcon width={16} height={16} />,
  area: <AreaIcon width={16} height={16} />,
  array: <ArrayIcon width={16} height={16} />,
  column: <ColumnIcon width={16} height={16} />,
  delete: <DeleteIcon width={16} height={16} />,
  distance: <DistanceIcon width={16} height={16} />,
  'furniture-component': <FurnitureComponentIcon width={16} height={16} />,
  hide: <HideIcon width={16} height={16} />,
  isolate: <IsolateIcon width={16} height={16} />,
  issue: <IssueIcon width={16} height={16} />,
  opening: <OpeningIcon width={16} height={16} />,
  railing: <RailingIcon width={16} height={16} />,
  'reference-line': <ReferenceLineIcon width={16} height={16} />,
  roof: <RoofIcon width={16} height={16} />,
  'section-box': <SectionBoxIcon width={16} height={16} />,
  'select-similar': <SelectSimilarIcon width={16} height={16} />,
  'selection-filter': <SelectionFilterIcon width={16} height={16} />,
  slab: <SlabIcon width={16} height={16} />,
  'spot-elevation': <SpotElevationIcon width={16} height={16} />,
  stair: <StairIcon width={16} height={16} />,
  tag: <TagIcon width={16} height={16} />,
  unhide: <UnhideIcon width={16} height={16} />,
  'view-style': <ViewStyleIcon width={16} height={16} />,
  zoom: <ZoomIcon width={16} height={16} />,
};

/**
 * The registry tools with no ARQ glyph yet.
 *
 * Listed explicitly so the gap is a decision rather than a silence. The test
 * beside this file fails three ways: a new tool that is neither drawn nor
 * listed, a tool listed here that has since gained a glyph, and an entry in
 * `TOOL_ICONS` that no longer names a real tool.
 *
 * Nearly all of these are BIM domain concepts - slab, roof, stair, railing,
 * column, opening, section box, spot elevation - which is exactly the case the
 * Version 12 icon rules reserve for a custom ARQ symbol rather than a library
 * import, because no general icon set draws them adequately.
 */
export const TOOLS_AWAITING_ICON: readonly string[] = [];

/**
 * A glyph per tool group, so the rail can be a dock rather than a column of
 * words.
 *
 * These are eight purpose-drawn ARQ glyphs (`design/icons/svg/group-*.svg`),
 * not a member tool's icon borrowed to stand for its group and not a second
 * icon family imported alongside the first. The Version 12 icon rules allow a
 * custom ARQ symbol exactly where no adequate library icon exists for a domain
 * concept, and "the Build group" is such a concept - the Font Awesome subset
 * the package ships is scoped by its own manifest to "reference mockups only".
 */
export const TOOL_GROUP_ICONS: Readonly<Record<string, ReactNode>> = {
  select: <GroupSelectIcon />,
  draw: <GroupDrawIcon />,
  build: <GroupBuildIcon />,
  modify: <GroupModifyIcon />,
  annotate: <GroupAnnotateIcon />,
  measure: <GroupMeasureIcon />,
  view: <GroupViewIcon />,
  review: <GroupReviewIcon />,
};

/**
 * A glyph per workspace mode.
 *
 * The mode rail showed five words in a 112px column beside a 48px column of
 * icons, which is most of what made the left edge a wall rather than a dock.
 * The label survives as the button's accessible name and tooltip, so nothing is
 * lost to a screen reader or to a pointer user who asks.
 */
export const MODE_ICONS: Readonly<Record<string, ReactNode>> = {
  design: <GroupDrawIcon width={20} height={20} />,
  document: <SheetIcon width={20} height={20} />,
  inspect: <InspectIcon width={20} height={20} />,
  review: <GroupReviewIcon width={20} height={20} />,
  present: <PlanIcon width={20} height={20} />,
};

/**
 * Glyphs for the project bar's actions.
 *
 * The bar read as a row of words - Undo Redo Open Share Search Account - where
 * the reference gives the same actions as marks and keeps the words for the
 * accessible name and the tooltip. A bar of prose competes with the project's
 * own name, which is the one thing on it that should carry weight.
 */
export const TOP_BAR_ACTION_ICONS: Readonly<Record<string, ReactNode>> = {
  undo: <HistoryIcon width={18} height={18} />,
  redo: <RotateIcon width={18} height={18} />,
  'command-search': <InspectIcon width={18} height={18} />,
  open: <ArqArchiveIcon width={18} height={18} />,
  account: <GroupReviewIcon width={18} height={18} />,
  share: <ExportIcon width={18} height={18} />,
};
