import { ASTRONOMICAL_UNIT_M, GRAVITATIONAL_CONSTANT } from "../physics/constants";
import { vector, type Vector3 } from "../domain/vector";

export interface OrbitalElements {
  readonly semiMajorAxisAu: number;
  readonly eccentricity: number;
  readonly inclinationDeg: number;
  readonly meanLongitudeDeg: number;
  readonly longitudePerihelionDeg: number;
  readonly longitudeAscendingNodeDeg: number;
}

export interface CartesianState {
  readonly positionM: Vector3;
  readonly velocityMps: Vector3;
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  let anomaly = meanAnomaly;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const correction =
      (anomaly - eccentricity * Math.sin(anomaly) - meanAnomaly) /
      (1 - eccentricity * Math.cos(anomaly));
    anomaly -= correction;
    if (Math.abs(correction) < 1e-13) break;
  }
  return anomaly;
}

export function orbitalElementsToState(
  elements: OrbitalElements,
  centralMassKg: number,
): CartesianState {
  const semiMajorAxisM = elements.semiMajorAxisAu * ASTRONOMICAL_UNIT_M;
  const inclination = radians(elements.inclinationDeg);
  const ascendingNode = radians(elements.longitudeAscendingNodeDeg);
  const argumentPerihelion = radians(
    elements.longitudePerihelionDeg - elements.longitudeAscendingNodeDeg,
  );
  const meanAnomaly = radians(
    elements.meanLongitudeDeg - elements.longitudePerihelionDeg,
  );
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, elements.eccentricity);
  const cosE = Math.cos(eccentricAnomaly);
  const sinE = Math.sin(eccentricAnomaly);
  const root = Math.sqrt(1 - elements.eccentricity ** 2);

  const orbitalX = semiMajorAxisM * (cosE - elements.eccentricity);
  const orbitalY = semiMajorAxisM * root * sinE;
  const meanMotion = Math.sqrt(
    (GRAVITATIONAL_CONSTANT * centralMassKg) / semiMajorAxisM ** 3,
  );
  const divisor = 1 - elements.eccentricity * cosE;
  const orbitalVx = (-semiMajorAxisM * meanMotion * sinE) / divisor;
  const orbitalVy = (semiMajorAxisM * meanMotion * root * cosE) / divisor;

  const cosNode = Math.cos(ascendingNode);
  const sinNode = Math.sin(ascendingNode);
  const cosPerihelion = Math.cos(argumentPerihelion);
  const sinPerihelion = Math.sin(argumentPerihelion);
  const cosInclination = Math.cos(inclination);
  const sinInclination = Math.sin(inclination);

  const transform = (x: number, y: number): Vector3 =>
    vector(
      (cosNode * cosPerihelion - sinNode * sinPerihelion * cosInclination) * x +
        (-cosNode * sinPerihelion - sinNode * cosPerihelion * cosInclination) * y,
      (sinNode * cosPerihelion + cosNode * sinPerihelion * cosInclination) * x +
        (-sinNode * sinPerihelion + cosNode * cosPerihelion * cosInclination) * y,
      sinPerihelion * sinInclination * x + cosPerihelion * sinInclination * y,
    );

  return {
    positionM: transform(orbitalX, orbitalY),
    velocityMps: transform(orbitalVx, orbitalVy),
  };
}
