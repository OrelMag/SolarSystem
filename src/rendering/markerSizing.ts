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
}

export interface MarkerSizingResult {
  readonly worldRadius: number;
  readonly pixelRadius: number;
}

export const MIN_BODY_SCALE = 0.25;
export const MAX_BODY_SCALE = 4;

const READABLE_RADIUS_PX: Readonly<Record<MarkerCategory, number>> = {
  star: 22,
  planet: 14,
  moon: 8,
  "dwarf-planet": 10,
  "minor-body": 8,
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
  const pixelRadius = (basePixelRadius + selectedBoost) * manualScale;
  return {
    worldRadius: pixelRadius * worldUnitsPerPixel,
    pixelRadius,
  };
}
