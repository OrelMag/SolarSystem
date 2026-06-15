import type { Vector3 } from "../domain/vector";
import { scale } from "../domain/vector";

export interface DistanceScaleConfig {
  readonly scaleFactor: number;
}

export const DEFAULT_DISTANCE_SCALE: DistanceScaleConfig = {
  scaleFactor: 1,
};

export function scaleDistanceForDisplay(
  positionM: Vector3,
  config: DistanceScaleConfig,
): Vector3 {
  if (!(config.scaleFactor >= 1) || !Number.isFinite(config.scaleFactor)) {
    throw new Error("Distance display scale requires a finite scaleFactor >= 1.");
  }
  return scale(positionM, config.scaleFactor);
}
