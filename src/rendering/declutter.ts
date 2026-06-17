import type { MarkerCategory } from "./markerSizing";

export interface DeclutterItem {
  readonly id: string;
  readonly category: MarkerCategory;
  readonly screenXPx: number;
  readonly screenYPx: number;
  readonly markerRadiusPx: number;
  readonly selected: boolean;
  readonly baseVisible: boolean;
  readonly labelWidthPx?: number;
  readonly labelHeightPx?: number;
}

export interface DeclutterOptions {
  readonly viewportWidthPx: number;
  readonly viewportHeightPx: number;
  readonly paddingPx?: number;
  readonly labelGapPx?: number;
}

export interface DeclutterResult {
  readonly visibleIds: ReadonlySet<string>;
  readonly hiddenIds: ReadonlySet<string>;
  readonly labelVisibleIds: ReadonlySet<string>;
  readonly labelHiddenIds: ReadonlySet<string>;
}

interface RankedItem {
  readonly item: DeclutterItem;
  readonly index: number;
}

interface Bounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export const DEFAULT_DECLUTTER_PADDING_PX = 4;
const DEFAULT_LABEL_GAP_PX = 18;

export function calculateDeclutterVisibility(
  items: readonly DeclutterItem[],
  options: DeclutterOptions,
): DeclutterResult {
  const paddingPx = finiteOrDefault(options.paddingPx, DEFAULT_DECLUTTER_PADDING_PX);
  const labelGapPx = finiteOrDefault(options.labelGapPx, DEFAULT_LABEL_GAP_PX);
  const viewportBounds: Bounds = {
    left: 0,
    right: Math.max(0, options.viewportWidthPx),
    top: 0,
    bottom: Math.max(0, options.viewportHeightPx),
  };
  const visibleIds = new Set<string>();
  const hiddenIds = new Set<string>();
  const acceptedMarkerBounds: Bounds[] = [];
  const ranked = items
    .map((item, index): RankedItem => ({
      item,
      index,
    }))
    .sort(compareRankedItems);

  for (const rankedItem of ranked) {
    const { item } = rankedItem;
    if (!item.baseVisible) {
      hiddenIds.add(item.id);
      continue;
    }
    const markerBounds = itemMarkerBounds(item, paddingPx);
    if (!boundsOverlap(markerBounds, viewportBounds)) {
      visibleIds.add(item.id);
      continue;
    }
    if (isAlwaysVisible(item)) {
      visibleIds.add(item.id);
      acceptedMarkerBounds.push(markerBounds);
      continue;
    }
    const overlapsAccepted = acceptedMarkerBounds.some((candidate) =>
      boundsOverlap(markerBounds, candidate),
    );
    if (overlapsAccepted) {
      hiddenIds.add(item.id);
    } else {
      visibleIds.add(item.id);
      acceptedMarkerBounds.push(markerBounds);
    }
  }

  const labelVisibleIds = new Set<string>();
  const labelHiddenIds = new Set<string>();
  const acceptedLabelBounds = [
    ...ranked
      .filter((rankedItem) => visibleIds.has(rankedItem.item.id))
      .map((rankedItem) => itemMarkerBounds(rankedItem.item, paddingPx)),
  ];
  for (const rankedItem of ranked) {
    const { item } = rankedItem;
    if (!visibleIds.has(item.id) || !itemHasLabel(item)) {
      labelHiddenIds.add(item.id);
      continue;
    }
    const labelBounds = itemLabelBounds(item, paddingPx, labelGapPx);
    if (!boundsOverlap(labelBounds, viewportBounds)) {
      labelHiddenIds.add(item.id);
      continue;
    }
    if (item.selected) {
      labelVisibleIds.add(item.id);
      acceptedLabelBounds.push(labelBounds);
      continue;
    }
    const overlapsAccepted = acceptedLabelBounds.some((candidate) =>
      boundsOverlap(labelBounds, candidate),
    );
    if (overlapsAccepted) {
      labelHiddenIds.add(item.id);
    } else {
      labelVisibleIds.add(item.id);
      acceptedLabelBounds.push(labelBounds);
    }
  }

  return { visibleIds, hiddenIds, labelVisibleIds, labelHiddenIds };
}

function compareRankedItems(a: RankedItem, b: RankedItem): number {
  const priority = categoryPriority(a.item) - categoryPriority(b.item);
  if (priority !== 0) return priority;
  const radius = b.item.markerRadiusPx - a.item.markerRadiusPx;
  if (radius !== 0) return radius;
  return a.index - b.index;
}

function categoryPriority(item: DeclutterItem): number {
  if (item.selected) return 0;
  if (item.category === "star") return 1;
  if (item.category === "planet") return 2;
  if (item.category === "dwarf-planet") return 3;
  return 4;
}

function isAlwaysVisible(item: DeclutterItem): boolean {
  return item.selected || item.category === "star" || item.category === "planet";
}

function itemMarkerBounds(item: DeclutterItem, paddingPx: number): Bounds {
  const radius = Math.max(0, finiteOrDefault(item.markerRadiusPx, 0));
  const edgePadding = paddingPx / 2;
  return {
    left: item.screenXPx - radius - edgePadding,
    right: item.screenXPx + radius + edgePadding,
    top: item.screenYPx - radius - edgePadding,
    bottom: item.screenYPx + radius + edgePadding,
  };
}

function itemLabelBounds(item: DeclutterItem, paddingPx: number, labelGapPx: number): Bounds {
  const radius = Math.max(0, finiteOrDefault(item.markerRadiusPx, 0));
  const labelWidth = Math.max(0, finiteOrDefault(item.labelWidthPx, 0));
  const labelHeight = Math.max(0, finiteOrDefault(item.labelHeightPx, 0));
  const edgePadding = paddingPx / 2;
  return {
    left: item.screenXPx + radius + labelGapPx - edgePadding,
    right: item.screenXPx + radius + labelGapPx + labelWidth + edgePadding,
    top: item.screenYPx - labelHeight / 2 - edgePadding,
    bottom: item.screenYPx + labelHeight / 2 + edgePadding,
  };
}

function itemHasLabel(item: DeclutterItem): boolean {
  return (
    finiteOrDefault(item.labelWidthPx, 0) > 0 &&
    finiteOrDefault(item.labelHeightPx, 0) > 0
  );
}

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
