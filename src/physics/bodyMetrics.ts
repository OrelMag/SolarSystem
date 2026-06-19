import type { MutableBodyState } from "../domain/types";
import { cross, magnitude, magnitudeSquared, subtract } from "../domain/vector";
import { GRAVITATIONAL_CONSTANT } from "./constants";

export interface BodyScientificMetrics {
  readonly centralBodyId?: string;
  readonly centralBodyName?: string;
  readonly distanceFromCentralM?: number;
  readonly relativeSpeedMps?: number;
  readonly barycentricSpeedMps: number;
  readonly orbitalPeriodSeconds?: number;
  readonly periapsisM?: number;
  readonly apoapsisM?: number;
}

export function calculateBodyScientificMetrics(input: {
  readonly body: Readonly<MutableBodyState>;
  readonly bodies: readonly Readonly<MutableBodyState>[];
}): BodyScientificMetrics {
  const centralBody = findCentralBody(input.body, input.bodies);
  const relativePositionM = centralBody
    ? subtract(input.body.positionM, centralBody.positionM)
    : input.body.positionM;
  const relativeVelocityMps = centralBody
    ? subtract(input.body.velocityMps, centralBody.velocityMps)
    : input.body.velocityMps;
  const distanceFromCentralM = magnitude(relativePositionM);
  const relativeSpeedMps = magnitude(relativeVelocityMps);
  const orbit = centralBody
    ? calculateBoundOrbitEstimate({
        primaryMassKg: centralBody.massKg,
        secondaryMassKg: input.body.massKg,
        distanceM: distanceFromCentralM,
        relativePositionM,
        relativeVelocityMps,
      })
    : undefined;

  return {
    centralBodyId: centralBody?.id,
    centralBodyName: centralBody?.name,
    distanceFromCentralM,
    relativeSpeedMps,
    barycentricSpeedMps: magnitude(input.body.velocityMps),
    ...orbit,
  };
}

function findCentralBody(
  body: Readonly<MutableBodyState>,
  bodies: readonly Readonly<MutableBodyState>[],
): Readonly<MutableBodyState> | undefined {
  if (body.id === "sun") return undefined;
  return bodies.find((candidate) => candidate.id === (body.parentId ?? "sun"));
}

function calculateBoundOrbitEstimate(input: {
  readonly primaryMassKg: number;
  readonly secondaryMassKg: number;
  readonly distanceM: number;
  readonly relativePositionM: Readonly<MutableBodyState>["positionM"];
  readonly relativeVelocityMps: Readonly<MutableBodyState>["velocityMps"];
}): Pick<
  BodyScientificMetrics,
  "orbitalPeriodSeconds" | "periapsisM" | "apoapsisM"
> | undefined {
  if (!(input.distanceM > 0)) return undefined;

  const mu = GRAVITATIONAL_CONSTANT * (input.primaryMassKg + input.secondaryMassKg);
  const speedSquared = magnitudeSquared(input.relativeVelocityMps);
  const specificEnergy = speedSquared / 2 - mu / input.distanceM;
  if (!(specificEnergy < 0)) return undefined;

  const semiMajorAxisM = -mu / (2 * specificEnergy);
  const angularMomentum = magnitude(cross(input.relativePositionM, input.relativeVelocityMps));
  const eccentricitySquared = 1 + (2 * specificEnergy * angularMomentum ** 2) / mu ** 2;
  const eccentricity = Math.sqrt(Math.max(0, eccentricitySquared));
  if (!Number.isFinite(semiMajorAxisM) || !Number.isFinite(eccentricity)) return undefined;

  return {
    orbitalPeriodSeconds: 2 * Math.PI * Math.sqrt(semiMajorAxisM ** 3 / mu),
    periapsisM: semiMajorAxisM * (1 - eccentricity),
    apoapsisM: semiMajorAxisM * (1 + eccentricity),
  };
}
