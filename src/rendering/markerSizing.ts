import type { BodyCategory } from "../domain/types";
import type { OrbitalBodyCategory } from "../domain/orbits";

export type MarkerScaleMode = "readable" | "physical";
export type MarkerCategory = BodyCategory | OrbitalBodyCategory | "comet";

export interface MarkerSizingInput {
  readonly mode: MarkerScaleMode;
  readonly category: MarkerCategory;
  readonly physicalRadiusM: number;
  readonly baseWorldRadius: number;
  readonly selected: boolean;
  readonly cameraZoom: number;
  readonly viewportHeightPx: number;
  readonly cameraWorldHeight: number;
  readonly manualScaleEnabled: boolean;
  readonly manualScale: number | undefined;
  readonly compactPrimaryMarkers?: boolean;
}

export interface MarkerSizingResult {
  readonly worldRadius: number;
  readonly pixelRadius: number;
}

export interface MarkerOverlapItem {
  readonly category: MarkerCategory;
  readonly screenXPx: number;
  readonly screenYPx: number;
  readonly pixelRadius: number;
  readonly baseVisible: boolean;
}

export const MIN_BODY_SCALE = 0.25;
export const MAX_BODY_SCALE = 4;
const PLANET_DOT_RADIUS_PX = 5;
const SELECTED_PLANET_DOT_RADIUS_PX = 7;
const SUN_COMPACT_RADIUS_PX = 9;
const SELECTED_SUN_COMPACT_RADIUS_PX = 11;
const MAX_DOT_MANUAL_SCALE = 1.25;
const PLANET_OVERLAP_PADDING_PX = 4;

const READABLE_RADIUS_PX: Readonly<Record<MarkerCategory, number>> = {
  star: 22,
  planet: 14,
  moon: 8,
  "dwarf-planet": 10,
  "minor-body": 8,
  spacecraft: 9,
  comet: 10,
};

export function clampBodyScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_BODY_SCALE, Math.max(MIN_BODY_SCALE, scale));
}

export function calculatePhysicalMarkerRadius(category: MarkerCategory, radiusM: number): number {
  if (category === "star") return 0.22;
  if (category === "moon") {
    return Math.max(0.055, Math.min(0.13, Math.log10(radiusM) * 0.035 - 0.08));
  }
  if (category === "spacecraft") return 0.11;
  if (category === "dwarf-planet") return 0.15;
  if (category === "comet") return 0.13;
  return Math.max(0.11, Math.min(0.38, Math.log10(radiusM) * 0.075 - 0.35));
}

export function calculateMarkerSizing(input: MarkerSizingInput): MarkerSizingResult {
  const worldUnitsPerPixel =
    input.cameraWorldHeight / Math.max(input.cameraZoom, 0.0001) / Math.max(input.viewportHeightPx, 1);
  const manualScale = input.manualScaleEnabled ? clampBodyScale(input.manualScale ?? 1) : 1;

  if (input.mode === "physical") {
    const worldRadius = input.baseWorldRadius * manualScale;
    return {
      worldRadius,
      pixelRadius: worldRadius / worldUnitsPerPixel,
    };
  }

  const basePixelRadius = READABLE_RADIUS_PX[input.category] ?? 10;
  const selectedBoost = input.selected ? 3 : 0;
  const pixelRadius =
    input.compactPrimaryMarkers &&
    (input.category === "star" || input.category === "planet")
      ? calculatePrimaryDotRadius(input.category, input.selected, manualScale)
      : (basePixelRadius + selectedBoost) * manualScale;
  return {
    worldRadius: pixelRadius * worldUnitsPerPixel,
    pixelRadius,
  };
}

export function shouldUsePlanetDotMarkers(
  items: readonly MarkerOverlapItem[],
  paddingPx = PLANET_OVERLAP_PADDING_PX,
): boolean {
  const visiblePrimaryItems = items.filter(
    (item) =>
      item.baseVisible &&
      (item.category === "star" || item.category === "planet") &&
      Number.isFinite(item.screenXPx) &&
      Number.isFinite(item.screenYPx),
  );

  for (let index = 0; index < visiblePrimaryItems.length; index += 1) {
    const item = visiblePrimaryItems[index];
    if (!item) continue;
    for (let otherIndex = index + 1; otherIndex < visiblePrimaryItems.length; otherIndex += 1) {
      const other = visiblePrimaryItems[otherIndex];
      if (!other || (item.category !== "planet" && other.category !== "planet")) continue;
      const distance = Math.hypot(item.screenXPx - other.screenXPx, item.screenYPx - other.screenYPx);
      const overlapDistance =
        Math.max(0, item.pixelRadius) + Math.max(0, other.pixelRadius) + Math.max(0, paddingPx);
      if (distance < overlapDistance) return true;
    }
  }

  return false;
}

function calculatePrimaryDotRadius(
  category: MarkerCategory,
  selected: boolean,
  manualScale: number,
): number {
  const baseRadius =
    category === "star"
      ? selected
        ? SELECTED_SUN_COMPACT_RADIUS_PX
        : SUN_COMPACT_RADIUS_PX
      : selected
        ? SELECTED_PLANET_DOT_RADIUS_PX
        : PLANET_DOT_RADIUS_PX;
  return baseRadius * Math.min(manualScale, MAX_DOT_MANUAL_SCALE);
}
