import type {
  OrbitalParticle,
  ParticleBeltDefinition,
} from "../domain/orbits";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";
import {
  degreesToRadians,
  J2000_JULIAN_DAY,
} from "../physics/orbitalMechanics";

export const BELT_DEFINITIONS: readonly ParticleBeltDefinition[] = [
  {
    id: "main-belt",
    name: "Main asteroid belt",
    count: 3_500,
    seed: 12_345,
    minimumSemiMajorAxisAu: 2.1,
    maximumSemiMajorAxisAu: 3.3,
    maximumEccentricity: 0.18,
    maximumInclinationDeg: 14,
    excludedSemiMajorAxisAu: [
      { center: 2.5, halfWidth: 0.025 },
      { center: 2.82, halfWidth: 0.025 },
      { center: 2.95, halfWidth: 0.022 },
    ],
    color: 0x9e8f7a,
    opacity: 0.55,
  },
  {
    id: "kuiper-belt",
    name: "Kuiper belt",
    count: 2_500,
    seed: 67_890,
    minimumSemiMajorAxisAu: 30,
    maximumSemiMajorAxisAu: 50,
    maximumEccentricity: 0.22,
    maximumInclinationDeg: 20,
    color: 0x5e7897,
    opacity: 0.38,
  },
];

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
}

export function generateBeltParticles(
  definition: ParticleBeltDefinition,
): OrbitalParticle[] {
  const random = seededRandom(definition.seed);
  const particles: OrbitalParticle[] = [];
  while (particles.length < definition.count) {
    const semiMajorAxisAu =
      definition.minimumSemiMajorAxisAu +
      random() *
        (definition.maximumSemiMajorAxisAu -
          definition.minimumSemiMajorAxisAu);
    const excluded = definition.excludedSemiMajorAxisAu?.some(
      (gap) => Math.abs(semiMajorAxisAu - gap.center) < gap.halfWidth,
    );
    if (excluded) continue;
    particles.push({
      elements: {
        semiMajorAxisM: semiMajorAxisAu * ASTRONOMICAL_UNIT_M,
        eccentricity: random() * definition.maximumEccentricity,
        inclinationRad: degreesToRadians(
          (random() - 0.5) * 2 * definition.maximumInclinationDeg,
        ),
        longitudeAscendingNodeRad: random() * Math.PI * 2,
        argumentPeriapsisRad: random() * Math.PI * 2,
        meanAnomalyAtEpochRad: random() * Math.PI * 2,
        epochJulianDay: J2000_JULIAN_DAY,
      },
    });
  }
  return particles;
}
