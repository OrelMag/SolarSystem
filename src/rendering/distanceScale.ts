import type { Vector3 } from "../domain/vector";
import { magnitude, scale } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";

export interface DistanceScaleConfig {
  readonly innerScale: number;
  readonly transitionRadiusAu: number;
}

export const DEFAULT_DISTANCE_SCALE: DistanceScaleConfig = {
  innerScale: 1,
  transitionRadiusAu: 8,
};

export function scaleDistanceForDisplay(
  positionM: Vector3,
  config: DistanceScaleConfig,
): Vector3 {
  if (!(config.innerScale >= 1) || !(config.transitionRadiusAu > 0)) {
    throw new Error("Distance display scale requires innerScale >= 1 and a positive radius.");
  }
  const radiusAu = magnitude(positionM) / ASTRONOMICAL_UNIT_M;
  if (radiusAu === 0) return positionM;
  const influence = Math.max(0, 1 - radiusAu / config.transitionRadiusAu);
  const smoothInfluence = influence * influence * (3 - 2 * influence);
  return scale(positionM, 1 + (config.innerScale - 1) * smoothInfluence);
}
