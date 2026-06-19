import { BELT_DEFINITIONS, generateBeltParticles } from "../data/belts";
import { COMETS } from "../data/comets";
import {
  createPhysicalSolarSystem,
  PHYSICAL_ORBITAL_BODIES,
  PHYSICAL_SOLAR_DATASET_METADATA,
} from "../data/physicalSolarSystem";
import {
  createHorizonsSolarSystem,
  HORIZONS_SOLAR_DATASET_METADATA,
} from "../data/horizonsSolarSystem";
import {
  createHorizonsExtendedSolarSystem,
  HORIZONS_EXTENDED_SOLAR_DATASET_METADATA,
} from "../data/horizonsExtendedSolarSystem";
import type {
  HierarchicalOrbitalBody,
  OrbitalParticle,
  ParticleBeltDefinition,
} from "../domain/orbits";
import type { CelestialBody } from "../domain/types";
import { scale, vector } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M, DAY_SECONDS } from "../physics/constants";

export interface ScenarioMetadata {
  readonly datasetId:
    | "jpl-approximate-j2000"
    | "jpl-horizons-cartesian-j2000"
    | "jpl-horizons-extended-cartesian-j2000"
    | "analytic-two-body-validation";
  readonly source: string;
  readonly sourceUrl: string;
  readonly epoch: string;
  readonly referenceFrame: string;
  readonly originalUnits: string;
  readonly conversionApplied: string;
  readonly notes: string;
}

export interface ScenarioBelt {
  readonly definition: ParticleBeltDefinition;
  readonly particles: readonly OrbitalParticle[];
}

export interface ScenarioDefinition {
  readonly id:
    | "full-solar-system"
    | "horizons-solar-system"
    | "horizons-extended-system"
    | "inner-planets"
    | "outer-planets"
    | "two-body-validation";
  readonly label: string;
  readonly description: string;
  readonly defaultTargetId: string;
  readonly metadata: ScenarioMetadata;
  readonly createBodies: () => CelestialBody[];
  readonly physicalOrbitalBodies: readonly HierarchicalOrbitalBody[];
  readonly displayOnlyOrbitalBodies: readonly HierarchicalOrbitalBody[];
  readonly belts: readonly ScenarioBelt[];
}

const allBelts = (): readonly ScenarioBelt[] =>
  BELT_DEFINITIONS.map((definition) => ({
    definition,
    particles: generateBeltParticles(definition),
  }));

const filterPhysicalBodies = (
  bodies: readonly CelestialBody[],
  allowedRoots: readonly string[],
): CelestialBody[] => {
  const known = new Set(allowedRoots);
  const result = bodies.filter((body) => {
    if (!known.has(body.id)) return false;
    return true;
  });
  let added = true;
  while (added) {
    added = false;
    for (const body of bodies) {
      if (known.has(body.id) || !body.parentId || !known.has(body.parentId)) continue;
      result.push(body);
      known.add(body.id);
      added = true;
    }
  }
  return result;
};

const filterDisplayOnlyBodies = (
  bodies: readonly HierarchicalOrbitalBody[],
  allowedParents: readonly string[],
): readonly HierarchicalOrbitalBody[] => {
  const known = new Set(allowedParents);
  const result: HierarchicalOrbitalBody[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const body of bodies) {
      if (known.has(body.id) || !known.has(body.parentId)) continue;
      result.push(body);
      known.add(body.id);
      added = true;
    }
  }
  return result;
};

const solarMetadata: ScenarioMetadata = {
  datasetId: PHYSICAL_SOLAR_DATASET_METADATA.datasetId,
  source: PHYSICAL_SOLAR_DATASET_METADATA.source,
  sourceUrl: PHYSICAL_SOLAR_DATASET_METADATA.sourceUrl,
  epoch: PHYSICAL_SOLAR_DATASET_METADATA.epoch,
  referenceFrame: PHYSICAL_SOLAR_DATASET_METADATA.referenceFrame,
  originalUnits: PHYSICAL_SOLAR_DATASET_METADATA.originalUnits,
  conversionApplied: PHYSICAL_SOLAR_DATASET_METADATA.conversionApplied,
  notes: PHYSICAL_SOLAR_DATASET_METADATA.notes,
};

function createTwoBodyValidation(): CelestialBody[] {
  const sunMassKg = 1.988_47e30;
  const earthMassKg = 5.972_19e24;
  const radiusM = ASTRONOMICAL_UNIT_M;
  const speedMps = Math.sqrt((6.674_3e-11 * sunMassKg) / radiusM);
  return [
    {
      id: "validation-primary",
      name: "Validation Primary",
      category: "star",
      massKg: sunMassKg,
      radiusM: 696_340_000,
      positionM: scale(vector(radiusM, 0, 0), -earthMassKg / sunMassKg),
      velocityMps: scale(vector(0, speedMps, 0), -earthMassKg / sunMassKg),
      visual: { color: 0xffd279, emissive: 0xffa62b },
    },
    {
      id: "validation-orbiter",
      name: "Validation Orbiter",
      category: "planet",
      parentId: "validation-primary",
      massKg: earthMassKg,
      radiusM: 6_371_000,
      positionM: vector(radiusM, 0, 0),
      velocityMps: vector(0, speedMps, 0),
      visual: { color: 0x4c86d9 },
    },
  ];
}

export const SCENARIOS: readonly ScenarioDefinition[] = [
  {
    id: "full-solar-system",
    label: "Full Solar System",
    description: "Sun, eight planets, Pluto, physical major moons, comets, and belt particles.",
    defaultTargetId: "sun",
    metadata: solarMetadata,
    createBodies: createPhysicalSolarSystem,
    physicalOrbitalBodies: PHYSICAL_ORBITAL_BODIES,
    displayOnlyOrbitalBodies: COMETS,
    belts: allBelts(),
  },
  {
    id: "horizons-solar-system",
    label: "Horizons Planets",
    description: "Sun and eight planets from JPL/Horizons Cartesian state vectors.",
    defaultTargetId: "sun",
    metadata: {
      datasetId: HORIZONS_SOLAR_DATASET_METADATA.datasetId,
      source: HORIZONS_SOLAR_DATASET_METADATA.source,
      sourceUrl: HORIZONS_SOLAR_DATASET_METADATA.sourceUrl,
      epoch: HORIZONS_SOLAR_DATASET_METADATA.epoch,
      referenceFrame: HORIZONS_SOLAR_DATASET_METADATA.referenceFrame,
      originalUnits: HORIZONS_SOLAR_DATASET_METADATA.originalUnits,
      conversionApplied: HORIZONS_SOLAR_DATASET_METADATA.conversionApplied,
      notes: HORIZONS_SOLAR_DATASET_METADATA.notes,
    },
    createBodies: createHorizonsSolarSystem,
    physicalOrbitalBodies: [],
    displayOnlyOrbitalBodies: [],
    belts: [],
  },
  {
    id: "horizons-extended-system",
    label: "Horizons Extended",
    description:
      "Horizons Cartesian vectors for the Sun, eight planets, Pluto, and 12 major moons.",
    defaultTargetId: "sun",
    metadata: {
      datasetId: HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.datasetId,
      source: HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.source,
      sourceUrl: HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.sourceUrl,
      epoch: HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.epoch,
      referenceFrame: HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.referenceFrame,
      originalUnits: HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.originalUnits,
      conversionApplied: HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.conversionApplied,
      notes: HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.notes,
    },
    createBodies: createHorizonsExtendedSolarSystem,
    physicalOrbitalBodies: PHYSICAL_ORBITAL_BODIES,
    displayOnlyOrbitalBodies: COMETS,
    belts: allBelts(),
  },
  {
    id: "inner-planets",
    label: "Inner Planets",
    description: "Sun, terrestrial planets, physical nearby moons, comets, and the main belt.",
    defaultTargetId: "earth",
    metadata: solarMetadata,
    createBodies: () =>
      filterPhysicalBodies(createPhysicalSolarSystem(), ["sun", "mercury", "venus", "earth", "mars"]),
    physicalOrbitalBodies: PHYSICAL_ORBITAL_BODIES.filter((body) =>
      ["earth", "mars"].includes(body.parentId),
    ),
    displayOnlyOrbitalBodies: filterDisplayOnlyBodies(COMETS, [
      "sun",
      "mercury",
      "venus",
      "earth",
      "mars",
    ]),
    belts: allBelts().filter((belt) => belt.definition.id === "main-belt"),
  },
  {
    id: "outer-planets",
    label: "Outer Planets",
    description: "Sun, giant planets, physical Pluto system, major outer moons, comets, and Kuiper belt.",
    defaultTargetId: "jupiter",
    metadata: solarMetadata,
    createBodies: () =>
      filterPhysicalBodies(createPhysicalSolarSystem(), [
        "sun",
        "jupiter",
        "saturn",
        "uranus",
        "neptune",
        "pluto",
      ]),
    physicalOrbitalBodies: PHYSICAL_ORBITAL_BODIES.filter(
      (body) =>
        body.id === "pluto" ||
        ["jupiter", "saturn", "uranus", "neptune", "pluto"].includes(body.parentId),
    ),
    displayOnlyOrbitalBodies: filterDisplayOnlyBodies(COMETS, [
        "sun",
        "jupiter",
        "saturn",
        "uranus",
        "neptune",
        "pluto",
      ]),
    belts: allBelts().filter((belt) => belt.definition.id === "kuiper-belt"),
  },
  {
    id: "two-body-validation",
    label: "Two-Body Validation",
    description: "A deterministic circular-orbit scenario for checking conservation behavior.",
    defaultTargetId: "validation-orbiter",
    metadata: {
      datasetId: "analytic-two-body-validation",
      source: "Analytic circular two-body fixture",
      sourceUrl: "local deterministic fixture",
      epoch: "J2000.0 (2000-01-01T12:00:00Z)",
      referenceFrame: "Barycentric Cartesian SI fixture",
      originalUnits: "SI fixture",
      conversionApplied: "None",
      notes: `One 1 AU near-circular orbit with velocity derived from GM/r; intended for diagnostics, not astronomy.`,
    },
    createBodies: createTwoBodyValidation,
    physicalOrbitalBodies: [],
    displayOnlyOrbitalBodies: [],
    belts: [],
  },
] as const;

export function findScenario(id: string): ScenarioDefinition {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0]!;
}

export const DEFAULT_FIXED_TIMESTEP_SECONDS = 300;
export const DEFAULT_MAX_STEPS_PER_FRAME = 80;
export const DEFAULT_TIME_SCALE_SECONDS = 7 * DAY_SECONDS;
