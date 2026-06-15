import type { KeplerianElements, OrbitalState } from "../domain/orbits";
import {
  add,
  cross,
  dot,
  magnitude,
  magnitudeSquared,
  scale,
  subtract,
  vector,
  type Vector3,
} from "../domain/vector";
import {
  ASTRONOMICAL_UNIT_M,
  DAY_SECONDS,
  GRAVITATIONAL_CONSTANT,
} from "./constants";

const TWO_PI = Math.PI * 2;
export const J2000_JULIAN_DAY = 2_451_545;

export const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

function normalizeAngle(angle: number): number {
  const normalized = angle % TWO_PI;
  return normalized < 0 ? normalized + TWO_PI : normalized;
}

function solveEllipticAnomaly(meanAnomaly: number, eccentricity: number): number {
  const normalizedMeanAnomaly = normalizeAngle(meanAnomaly);
  let eccentricAnomaly = eccentricity < 0.8 ? normalizedMeanAnomaly : Math.PI;
  for (let iteration = 0; iteration < 15; iteration += 1) {
    const correction =
      (eccentricAnomaly -
        eccentricity * Math.sin(eccentricAnomaly) -
        normalizedMeanAnomaly) /
      (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= correction;
    if (Math.abs(correction) < 1e-12) break;
  }
  return eccentricAnomaly;
}

function rotateFromOrbitalPlane(
  x: number,
  y: number,
  elements: Pick<
    KeplerianElements,
    "inclinationRad" | "longitudeAscendingNodeRad" | "argumentPeriapsisRad"
  >,
): Vector3 {
  const cosNode = Math.cos(elements.longitudeAscendingNodeRad);
  const sinNode = Math.sin(elements.longitudeAscendingNodeRad);
  const cosPeriapsis = Math.cos(elements.argumentPeriapsisRad);
  const sinPeriapsis = Math.sin(elements.argumentPeriapsisRad);
  const cosInclination = Math.cos(elements.inclinationRad);
  const sinInclination = Math.sin(elements.inclinationRad);
  return vector(
    (cosNode * cosPeriapsis - sinNode * sinPeriapsis * cosInclination) * x +
      (-cosNode * sinPeriapsis - sinNode * cosPeriapsis * cosInclination) * y,
    (sinNode * cosPeriapsis + cosNode * sinPeriapsis * cosInclination) * x +
      (-sinNode * sinPeriapsis + cosNode * cosPeriapsis * cosInclination) * y,
    sinPeriapsis * sinInclination * x + cosPeriapsis * sinInclination * y,
  );
}

export function propagateEllipticOrbit(
  elements: KeplerianElements,
  julianDay: number,
  centralMassKg: number,
): OrbitalState {
  if (!(elements.semiMajorAxisM > 0) || elements.eccentricity < 0 || elements.eccentricity >= 1) {
    throw new Error("Elliptic propagation requires a positive semi-major axis and 0 <= e < 1.");
  }
  const gravitationalParameter = GRAVITATIONAL_CONSTANT * centralMassKg;
  const meanMotion = Math.sqrt(gravitationalParameter / elements.semiMajorAxisM ** 3);
  const elapsedSeconds = (julianDay - elements.epochJulianDay) * DAY_SECONDS;
  const meanAnomaly = elements.meanAnomalyAtEpochRad + meanMotion * elapsedSeconds;
  const eccentricAnomaly = solveEllipticAnomaly(meanAnomaly, elements.eccentricity);
  const cosE = Math.cos(eccentricAnomaly);
  const sinE = Math.sin(eccentricAnomaly);
  const root = Math.sqrt(1 - elements.eccentricity ** 2);
  const divisor = 1 - elements.eccentricity * cosE;
  const orbitalX = elements.semiMajorAxisM * (cosE - elements.eccentricity);
  const orbitalY = elements.semiMajorAxisM * root * sinE;
  const orbitalVx = (-elements.semiMajorAxisM * meanMotion * sinE) / divisor;
  const orbitalVy = (elements.semiMajorAxisM * meanMotion * root * cosE) / divisor;
  return {
    positionM: rotateFromOrbitalPlane(orbitalX, orbitalY, elements),
    velocityMps: rotateFromOrbitalPlane(orbitalVx, orbitalVy, elements),
  };
}

export function stateToOsculatingElements(
  positionM: Vector3,
  velocityMps: Vector3,
  centralMassKg: number,
  epochJulianDay: number,
): KeplerianElements {
  const mu = GRAVITATIONAL_CONSTANT * centralMassKg;
  const radius = magnitude(positionM);
  const speedSquared = magnitudeSquared(velocityMps);
  const angularMomentum = cross(positionM, velocityMps);
  const angularMomentumMagnitude = magnitude(angularMomentum);
  const node = cross(vector(0, 0, 1), angularMomentum);
  const nodeMagnitude = magnitude(node);
  const eccentricityVector = subtract(
    scale(cross(velocityMps, angularMomentum), 1 / mu),
    scale(positionM, 1 / radius),
  );
  const eccentricity = magnitude(eccentricityVector);
  const specificEnergy = speedSquared / 2 - mu / radius;
  const semiMajorAxisM = -mu / (2 * specificEnergy);
  const inclinationRad = Math.acos(
    Math.max(-1, Math.min(1, angularMomentum.z / angularMomentumMagnitude)),
  );
  const longitudeAscendingNodeRad =
    nodeMagnitude < 1e-12 ? 0 : normalizeAngle(Math.atan2(node.y, node.x));

  let argumentPeriapsisRad = 0;
  if (eccentricity > 1e-10 && nodeMagnitude > 1e-12) {
    argumentPeriapsisRad = Math.acos(
      Math.max(-1, Math.min(1, dot(node, eccentricityVector) / (nodeMagnitude * eccentricity))),
    );
    if (eccentricityVector.z < 0) argumentPeriapsisRad = TWO_PI - argumentPeriapsisRad;
  } else if (eccentricity > 1e-10) {
    argumentPeriapsisRad = normalizeAngle(Math.atan2(eccentricityVector.y, eccentricityVector.x));
  }

  let trueAnomaly = 0;
  if (eccentricity > 1e-10) {
    trueAnomaly = Math.acos(
      Math.max(-1, Math.min(1, dot(eccentricityVector, positionM) / (eccentricity * radius))),
    );
    if (dot(positionM, velocityMps) < 0) trueAnomaly = TWO_PI - trueAnomaly;
  } else if (nodeMagnitude > 1e-12) {
    trueAnomaly = Math.acos(
      Math.max(-1, Math.min(1, dot(node, positionM) / (nodeMagnitude * radius))),
    );
    if (positionM.z < 0) trueAnomaly = TWO_PI - trueAnomaly;
  } else {
    trueAnomaly = normalizeAngle(Math.atan2(positionM.y, positionM.x));
  }

  let meanAnomalyAtEpochRad: number;
  if (eccentricity < 1) {
    const eccentricAnomaly = 2 * Math.atan2(
      Math.sqrt(1 - eccentricity) * Math.sin(trueAnomaly / 2),
      Math.sqrt(1 + eccentricity) * Math.cos(trueAnomaly / 2),
    );
    meanAnomalyAtEpochRad = normalizeAngle(
      eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly),
    );
  } else {
    const hyperbolicAnomaly =
      2 *
      Math.atanh(
        Math.sqrt((eccentricity - 1) / (eccentricity + 1)) * Math.tan(trueAnomaly / 2),
      );
    meanAnomalyAtEpochRad =
      eccentricity * Math.sinh(hyperbolicAnomaly) - hyperbolicAnomaly;
  }

  return {
    semiMajorAxisM,
    eccentricity,
    inclinationRad,
    longitudeAscendingNodeRad,
    argumentPeriapsisRad,
    meanAnomalyAtEpochRad,
    epochJulianDay,
  };
}

export function sampleOrbitPath(
  elements: KeplerianElements,
  pointCount = 256,
): Vector3[] {
  const points: Vector3[] = [];
  if (elements.eccentricity < 1) {
    for (let index = 0; index <= pointCount; index += 1) {
      const eccentricAnomaly = (index / pointCount) * TWO_PI;
      const x =
        elements.semiMajorAxisM *
        (Math.cos(eccentricAnomaly) - elements.eccentricity);
      const y =
        elements.semiMajorAxisM *
        Math.sqrt(1 - elements.eccentricity ** 2) *
        Math.sin(eccentricAnomaly);
      points.push(rotateFromOrbitalPlane(x, y, elements));
    }
    return points;
  }

  const maximumTrueAnomaly = Math.acos(-1 / elements.eccentricity) * 0.96;
  const parameter = Math.abs(elements.semiMajorAxisM) * (elements.eccentricity ** 2 - 1);
  for (let index = 0; index <= pointCount; index += 1) {
    const trueAnomaly =
      -maximumTrueAnomaly + (index / pointCount) * maximumTrueAnomaly * 2;
    const radius = parameter / (1 + elements.eccentricity * Math.cos(trueAnomaly));
    points.push(
      rotateFromOrbitalPlane(
        radius * Math.cos(trueAnomaly),
        radius * Math.sin(trueAnomaly),
        elements,
      ),
    );
  }
  return points;
}

export function makeElementsFromDegrees(input: {
  readonly semiMajorAxisAu: number;
  readonly eccentricity: number;
  readonly inclinationDeg: number;
  readonly longitudeAscendingNodeDeg: number;
  readonly argumentPeriapsisDeg: number;
  readonly meanAnomalyDeg: number;
  readonly epochJulianDay: number;
}): KeplerianElements {
  return {
    semiMajorAxisM: input.semiMajorAxisAu * ASTRONOMICAL_UNIT_M,
    eccentricity: input.eccentricity,
    inclinationRad: degreesToRadians(input.inclinationDeg),
    longitudeAscendingNodeRad: degreesToRadians(input.longitudeAscendingNodeDeg),
    argumentPeriapsisRad: degreesToRadians(input.argumentPeriapsisDeg),
    meanAnomalyAtEpochRad: degreesToRadians(input.meanAnomalyDeg),
    epochJulianDay: input.epochJulianDay,
  };
}

export function relativeState(state: OrbitalState, origin: OrbitalState): OrbitalState {
  return {
    positionM: add(state.positionM, scale(origin.positionM, -1)),
    velocityMps: add(state.velocityMps, scale(origin.velocityMps, -1)),
  };
}
