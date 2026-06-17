import type { Vector3 } from "../domain/vector";
import { add, dot, magnitude, scale, subtract, vector } from "../domain/vector";
import type { LaunchTargetState } from "./launch";

export interface SpacecraftGuidanceBody {
  readonly positionM: Vector3;
  readonly velocityMps: Vector3;
}

export interface SpacecraftGuidanceConfig {
  readonly fixedTimestepSeconds: number;
  readonly arrivalThresholdM: number;
  readonly maxAccelerationMps2: number;
  readonly maxCruiseSpeedMps: number;
}

export type SpacecraftGuidanceMode = "guided" | "station-keeping";

export interface SpacecraftGuidanceResult {
  readonly deltaVelocityMps: Vector3;
  readonly distanceM: number;
  readonly mode: SpacecraftGuidanceMode;
  readonly arrived: boolean;
}

export const DEFAULT_SPACECRAFT_GUIDANCE = {
  maxAccelerationMps2: 0.5,
  maxCruiseSpeedMps: 600_000,
} as const;

export function calculateSpacecraftGuidance(input: {
  readonly spacecraft: SpacecraftGuidanceBody;
  readonly target: LaunchTargetState;
  readonly config: SpacecraftGuidanceConfig;
}): SpacecraftGuidanceResult {
  validateGuidanceConfig(input.config);
  const offsetToTargetM = subtract(input.target.positionM, input.spacecraft.positionM);
  const distanceM = magnitude(offsetToTargetM);
  if (!(distanceM > 0) || !Number.isFinite(distanceM)) {
    return {
      deltaVelocityMps: limitDeltaVelocity(
        subtract(input.target.velocityMps, input.spacecraft.velocityMps),
        input.config,
      ),
      distanceM: 0,
      mode: "station-keeping",
      arrived: true,
    };
  }

  if (distanceM <= input.config.arrivalThresholdM) {
    return {
      deltaVelocityMps: limitDeltaVelocity(
        subtract(input.target.velocityMps, input.spacecraft.velocityMps),
        input.config,
      ),
      distanceM,
      mode: "station-keeping",
      arrived: true,
    };
  }

  const directionToTarget = scale(offsetToTargetM, 1 / distanceM);
  const relativeVelocityMps = subtract(input.spacecraft.velocityMps, input.target.velocityMps);
  const closingSpeedMps = dot(relativeVelocityMps, directionToTarget);
  const remainingDistanceM = Math.max(0, distanceM - input.config.arrivalThresholdM);
  const brakingSpeedMps = Math.sqrt(
    2 * input.config.maxAccelerationMps2 * remainingDistanceM,
  );
  const desiredClosingSpeedMps = Math.max(
    0,
    Math.min(input.config.maxCruiseSpeedMps, brakingSpeedMps * 0.72),
  );
  const overspeedMps = Math.max(0, closingSpeedMps - desiredClosingSpeedMps);
  const desiredVelocityMps = add(
    input.target.velocityMps,
    scale(directionToTarget, desiredClosingSpeedMps - overspeedMps * 0.5),
  );
  return {
    deltaVelocityMps: limitDeltaVelocity(
      subtract(desiredVelocityMps, input.spacecraft.velocityMps),
      input.config,
    ),
    distanceM,
    mode: "guided",
    arrived: false,
  };
}

function validateGuidanceConfig(config: SpacecraftGuidanceConfig): void {
  if (!(config.fixedTimestepSeconds > 0) || !Number.isFinite(config.fixedTimestepSeconds)) {
    throw new Error("Guidance timestep must be finite and greater than zero.");
  }
  if (!(config.arrivalThresholdM > 0) || !Number.isFinite(config.arrivalThresholdM)) {
    throw new Error("Guidance arrival threshold must be finite and greater than zero.");
  }
  if (!(config.maxAccelerationMps2 > 0) || !Number.isFinite(config.maxAccelerationMps2)) {
    throw new Error("Guidance acceleration must be finite and greater than zero.");
  }
  if (!(config.maxCruiseSpeedMps > 0) || !Number.isFinite(config.maxCruiseSpeedMps)) {
    throw new Error("Guidance cruise speed must be finite and greater than zero.");
  }
}

function limitDeltaVelocity(
  deltaVelocityMps: Vector3,
  config: Pick<SpacecraftGuidanceConfig, "fixedTimestepSeconds" | "maxAccelerationMps2">,
): Vector3 {
  const magnitudeMps = magnitude(deltaVelocityMps);
  if (!(magnitudeMps > 0) || !Number.isFinite(magnitudeMps)) return vector();
  const maxDeltaVelocityMps = config.maxAccelerationMps2 * config.fixedTimestepSeconds;
  if (magnitudeMps <= maxDeltaVelocityMps) return deltaVelocityMps;
  return scale(deltaVelocityMps, maxDeltaVelocityMps / magnitudeMps);
}
