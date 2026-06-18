import type { Vector3 } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";
import { scaleDistanceForDisplay, type DistanceScaleConfig } from "./distanceScale";

export function calculateBarycenterScenePosition(input: {
  readonly barycenterM: Vector3;
  readonly frameOriginM: Vector3;
  readonly distanceScale: DistanceScaleConfig;
}): Vector3 {
  const displayPosition = scaleDistanceForDisplay(
    {
      x: input.barycenterM.x - input.frameOriginM.x,
      y: input.barycenterM.y - input.frameOriginM.y,
      z: input.barycenterM.z - input.frameOriginM.z,
    },
    input.distanceScale,
  );
  return {
    x: displayPosition.x / ASTRONOMICAL_UNIT_M,
    y: displayPosition.y / ASTRONOMICAL_UNIT_M,
    z: displayPosition.z / ASTRONOMICAL_UNIT_M,
  };
}
