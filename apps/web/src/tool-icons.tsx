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
export const TOOLS_AWAITING_ICON: readonly string[] = [
  'angle',
  'area',
  'array',
  'column',
  'delete',
  'distance',
  'furniture-component',
  'hide',
  'isolate',
  'issue',
  'opening',
  'railing',
  'reference-line',
  'roof',
  'section-box',
  'select-similar',
  'selection-filter',
  'slab',
  'spot-elevation',
  'stair',
  'tag',
  'unhide',
  'view-style',
  'zoom',
];
