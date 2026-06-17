import type { HierarchicalOrbitalBody } from "../domain/orbits";
import type { CelestialBody } from "../domain/types";
import { add, scale, vector } from "../domain/vector";
import { J2000_JULIAN_DAY } from "../physics/orbitalMechanics";
import { propagateHierarchicalBodies, validateOrbitalHierarchy } from "../physics/hierarchicalOrbits";
import { MAJOR_MOONS, PLUTO } from "./satellites";
import { createSolarSystem, SOLAR_DATASET_METADATA } from "./solarSystem";

export const PHYSICAL_SOLAR_DATASET_METADATA = {
  ...SOLAR_DATASET_METADATA,
  notes:
    `${SOLAR_DATASET_METADATA.notes} Pluto and 12 major moons are initialized from ` +
    "parent-relative J2000 orbital elements, then all physical bodies are shifted to a shared barycentric state.",
} as const;

export const PHYSICAL_ORBITAL_BODIES: readonly HierarchicalOrbitalBody[] = [
  PLUTO,
  ...MAJOR_MOONS,
];

function toPhysicalBody(state: ReturnType<typeof propagateHierarchicalBodies>[number]): CelestialBody {
  return {
    id: state.body.id,
    name: state.body.name,
    category: state.body.category === "comet" ? "minor-body" : state.body.category,
    parentId: state.body.parentId,
    massKg: state.body.massKg,
    radiusM: state.body.radiusM,
    positionM: { ...state.positionM },
    velocityMps: { ...state.velocityMps },
    visual: { ...state.body.visual },
  };
}

function barycentricCorrect(bodies: readonly CelestialBody[]): CelestialBody[] {
  let weightedPosition = vector();
  let weightedVelocity = vector();
  let totalMassKg = 0;

  for (const body of bodies) {
    weightedPosition = add(weightedPosition, scale(body.positionM, body.massKg));
    weightedVelocity = add(weightedVelocity, scale(body.velocityMps, body.massKg));
    totalMassKg += body.massKg;
  }

  const centerOfMass = scale(weightedPosition, 1 / totalMassKg);
  const centerVelocity = scale(weightedVelocity, 1 / totalMassKg);
  return bodies.map((body) => ({
    ...body,
    positionM: {
      x: body.positionM.x - centerOfMass.x,
      y: body.positionM.y - centerOfMass.y,
      z: body.positionM.z - centerOfMass.z,
    },
    velocityMps: {
      x: body.velocityMps.x - centerVelocity.x,
      y: body.velocityMps.y - centerVelocity.y,
      z: body.velocityMps.z - centerVelocity.z,
    },
    visual: { ...body.visual },
  }));
}

export function createPhysicalSolarSystem(): CelestialBody[] {
  const planets = createSolarSystem();
  validateOrbitalHierarchy(
    PHYSICAL_ORBITAL_BODIES,
    planets.map((body) => body.id),
  );
  const physicalOrbitalBodies = propagateHierarchicalBodies(
    PHYSICAL_ORBITAL_BODIES,
    planets,
    J2000_JULIAN_DAY,
  ).map(toPhysicalBody);

  return barycentricCorrect([...planets, ...physicalOrbitalBodies]);
}

export function isPhysicalMoonBody(body: Pick<CelestialBody, "category" | "parentId">): boolean {
  return body.category === "moon" && typeof body.parentId === "string";
}
