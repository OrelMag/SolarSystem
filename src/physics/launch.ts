import type { CelestialBody, MutableBodyState } from "../domain/types";
import {
  add,
  cross,
  magnitude,
  scale,
  subtract,
  vector,
  type Vector3,
} from "../domain/vector";
import { GRAVITATIONAL_CONSTANT } from "./constants";

export const ACTIVE_SPACECRAFT_ID = "spacecraft-active";
export const SPACECRAFT_LAUNCH_ALTITUDE_M = 400_000;
export const SPACECRAFT_MASS_KG = 10_000;
export const SPACECRAFT_RADIUS_M = 10;

export interface LaunchTargetState {
  readonly id: string;
  readonly name: string;
  readonly parentId?: string;
  readonly massKg: number;
  readonly radiusM: number;
  readonly positionM: Vector3;
  readonly velocityMps: Vector3;
}

export type LaunchTransferKind = "earth-moon" | "interplanetary";

export interface SpacecraftLaunch {
  readonly spacecraft: CelestialBody;
  readonly targetId: string;
  readonly targetName: string;
  readonly transferKind: LaunchTransferKind;
  readonly estimatedTransferSeconds: number;
  readonly launchDistanceM: number;
  readonly targetDistanceAtLaunchM: number;
  readonly injectionSpeedMps: number;
}

export function createEarthLaunch(input: {
  readonly bodies: readonly Readonly<MutableBodyState>[];
  readonly target: LaunchTargetState;
}): SpacecraftLaunch {
  const earth = input.bodies.find((body) => body.id === "earth");
  if (!earth) throw new Error("Launch mode requires Earth in the current scenario.");
  if (input.target.id === earth.id) {
    throw new Error("Launch target must be different from Earth.");
  }

  const launchOffsetDirection = unitOrThrow(
    subtract(input.target.positionM, earth.positionM),
    "Launch target is too close to Earth to define a launch direction.",
  );
  const launchDistanceM = earth.radiusM + SPACECRAFT_LAUNCH_ALTITUDE_M;
  const spacecraftPositionM = add(earth.positionM, scale(launchOffsetDirection, launchDistanceM));
  const targetDistanceAtLaunchM = magnitude(subtract(input.target.positionM, earth.positionM));
  const transfer =
    input.target.parentId === "earth"
      ? calculateEarthMoonTransfer({
          earth,
          target: input.target,
          launchDistanceM,
          launchOffsetDirection,
        })
      : calculateInterplanetaryTransfer({
          bodies: input.bodies,
          earth,
          target: input.target,
          launchDistanceM,
          launchOffsetDirection,
        });

  return {
    spacecraft: {
      id: ACTIVE_SPACECRAFT_ID,
      name: "Spacecraft",
      category: "spacecraft",
      parentId: transfer.transferKind === "earth-moon" ? "earth" : undefined,
      massKg: SPACECRAFT_MASS_KG,
      radiusM: SPACECRAFT_RADIUS_M,
      positionM: spacecraftPositionM,
      velocityMps: add(earth.velocityMps, transfer.departureVelocityMps),
      visual: { color: 0x8ee8ff },
    },
    targetId: input.target.id,
    targetName: input.target.name,
    transferKind: transfer.transferKind,
    estimatedTransferSeconds: transfer.estimatedTransferSeconds,
    launchDistanceM,
    targetDistanceAtLaunchM,
    injectionSpeedMps: magnitude(transfer.departureVelocityMps),
  };
}

function calculateEarthMoonTransfer(input: {
  readonly earth: Readonly<MutableBodyState>;
  readonly target: LaunchTargetState;
  readonly launchDistanceM: number;
  readonly launchOffsetDirection: Vector3;
}): {
  readonly transferKind: LaunchTransferKind;
  readonly estimatedTransferSeconds: number;
  readonly departureVelocityMps: Vector3;
} {
  const targetDistanceM = magnitude(subtract(input.target.positionM, input.earth.positionM));
  if (!(targetDistanceM > input.launchDistanceM)) {
    throw new Error("Launch target must be outside the parking orbit.");
  }

  const mu = GRAVITATIONAL_CONSTANT * (input.earth.massKg + input.target.massKg);
  const semiMajorAxisM = (input.launchDistanceM + targetDistanceM) / 2;
  const perigeeSpeedMps = Math.sqrt(
    mu * (2 / input.launchDistanceM - 1 / semiMajorAxisM),
  );
  const relativeTargetVelocity = subtract(input.target.velocityMps, input.earth.velocityMps);
  const tangent = unitOrFallback(
    relativeTargetVelocity,
    perpendicularInPlane(input.launchOffsetDirection),
  );
  return {
    transferKind: "earth-moon",
    estimatedTransferSeconds: Math.PI * Math.sqrt(semiMajorAxisM ** 3 / mu),
    departureVelocityMps: scale(tangent, perigeeSpeedMps),
  };
}

function calculateInterplanetaryTransfer(input: {
  readonly bodies: readonly Readonly<MutableBodyState>[];
  readonly earth: Readonly<MutableBodyState>;
  readonly target: LaunchTargetState;
  readonly launchDistanceM: number;
  readonly launchOffsetDirection: Vector3;
}): {
  readonly transferKind: LaunchTransferKind;
  readonly estimatedTransferSeconds: number;
  readonly departureVelocityMps: Vector3;
} {
  const sun = input.bodies.find((body) => body.id === "sun");
  if (!sun) throw new Error("Interplanetary launch mode requires the Sun.");
  const earthFromSun = subtract(input.earth.positionM, sun.positionM);
  const targetFromSun = subtract(input.target.positionM, sun.positionM);
  const earthSunDistanceM = magnitude(earthFromSun);
  const targetSunDistanceM = magnitude(targetFromSun);
  if (!(earthSunDistanceM > 0) || !(targetSunDistanceM > 0)) {
    throw new Error("Launch target must have a finite heliocentric distance.");
  }

  const muSun = GRAVITATIONAL_CONSTANT * sun.massKg;
  const transferSemiMajorAxisM = (earthSunDistanceM + targetSunDistanceM) / 2;
  const earthCircularSpeedMps = Math.sqrt(muSun / earthSunDistanceM);
  const transferSpeedAtEarthMps = Math.sqrt(
    muSun * (2 / earthSunDistanceM - 1 / transferSemiMajorAxisM),
  );
  const excessSpeedMps = Math.abs(transferSpeedAtEarthMps - earthCircularSpeedMps);
  const muEarth = GRAVITATIONAL_CONSTANT * input.earth.massKg;
  const escapeInjectionMps = Math.sqrt(
    2 * muEarth / input.launchDistanceM + excessSpeedMps ** 2,
  );
  const prograde = unitOrFallback(
    subtract(input.earth.velocityMps, sun.velocityMps),
    perpendicularInPlane(earthFromSun),
  );
  const directionSign = targetSunDistanceM >= earthSunDistanceM ? 1 : -1;
  return {
    transferKind: "interplanetary",
    estimatedTransferSeconds: Math.PI * Math.sqrt(transferSemiMajorAxisM ** 3 / muSun),
    departureVelocityMps: scale(prograde, escapeInjectionMps * directionSign),
  };
}

function unitOrThrow(value: Vector3, message: string): Vector3 {
  const length = magnitude(value);
  if (!(length > 0) || !Number.isFinite(length)) throw new Error(message);
  return scale(value, 1 / length);
}

function unitOrFallback(value: Vector3, fallback: Vector3): Vector3 {
  const length = magnitude(value);
  if (length > 0 && Number.isFinite(length)) return scale(value, 1 / length);
  return unitOrThrow(fallback, "Could not determine a finite launch direction.");
}

function perpendicularInPlane(direction: Vector3): Vector3 {
  const perpendicular = cross(vector(0, 0, 1), direction);
  if (magnitude(perpendicular) > 0) return perpendicular;
  return vector(0, 1, 0);
}
