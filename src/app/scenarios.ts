import { BELT_DEFINITIONS, generateBeltParticles } from "../data/belts";
import { COMETS } from "../data/comets";
import { EXPLORATION_BODIES } from "../data/satellites";
import { createSolarSystem, SOLAR_DATASET_METADATA } from "../data/solarSystem";
import type {
  HierarchicalOrbitalBody,
  OrbitalParticle,
  ParticleBeltDefinition,
} from "../domain/orbits";
import type { CelestialBody } from "../domain/types";
import { scale, vector } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M, DAY_SECONDS } from "../physics/constants";

export interface ScenarioMetadata {
  readonly source: string;
  readonly sourceUrl: string;
  readonly epoch: string;
  readonly referenceFrame: string;
  readonly notes: string;
}

export interface ScenarioBelt {
  readonly definition: ParticleBeltDefinition;
  readonly particles: readonly OrbitalParticle[];
}

export interface ScenarioDefinition {
  readonly id: "full-solar-system" | "inner-planets" | "outer-planets" | "two-body-validation";
  readonly label: string;
  readonly description: string;
  readonly defaultTargetId: string;
  readonly metadata: ScenarioMetadata;
  readonly createBodies: () => CelestialBody[];
  readonly orbitalBodies: readonly HierarchicalOrbitalBody[];
  readonly belts: readonly ScenarioBelt[];
}

const allBelts = (): readonly ScenarioBelt[] =>
  BELT_DEFINITIONS.map((definition) => ({
    definition,
    particles: generateBeltParticles(definition),
  }));

const filterSolarBodies = (ids: readonly string[]): CelestialBody[] => {
  const allowed = new Set(ids);
  return createSolarSystem().filter((body) => allowed.has(body.id));
};

const filterOrbitalBodies = (
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
  source: SOLAR_DATASET_METADATA.source,
  sourceUrl: SOLAR_DATASET_METADATA.sourceUrl,
  epoch: SOLAR_DATASET_METADATA.epoch,
  referenceFrame: SOLAR_DATASET_METADATA.referenceFrame,
  notes: SOLAR_DATASET_METADATA.notes,
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
    description: "Sun, eight planets, Pluto, major moons, comets, and belt particles.",
    defaultTargetId: "sun",
    metadata: solarMetadata,
    createBodies: createSolarSystem,
    orbitalBodies: [...COMETS, ...EXPLORATION_BODIES],
    belts: allBelts(),
  },
  {
    id: "inner-planets",
    label: "Inner Planets",
    description: "Sun, terrestrial planets, nearby moons, comets, and the main belt.",
    defaultTargetId: "earth",
    metadata: solarMetadata,
    createBodies: () => filterSolarBodies(["sun", "mercury", "venus", "earth", "mars"]),
    orbitalBodies: [
      ...COMETS,
      ...filterOrbitalBodies(EXPLORATION_BODIES, ["sun", "mercury", "venus", "earth", "mars"]),
    ],
    belts: allBelts().filter((belt) => belt.definition.id === "main-belt"),
  },
  {
    id: "outer-planets",
    label: "Outer Planets",
    description: "Sun, giant planets, Pluto system, major outer moons, comets, and Kuiper belt.",
    defaultTargetId: "jupiter",
    metadata: solarMetadata,
    createBodies: () => filterSolarBodies(["sun", "jupiter", "saturn", "uranus", "neptune"]),
    orbitalBodies: [
      ...COMETS,
      ...filterOrbitalBodies(EXPLORATION_BODIES, [
        "sun",
        "jupiter",
        "saturn",
        "uranus",
        "neptune",
      ]),
    ],
    belts: allBelts().filter((belt) => belt.definition.id === "kuiper-belt"),
  },
  {
    id: "two-body-validation",
    label: "Two-Body Validation",
    description: "A deterministic circular-orbit scenario for checking conservation behavior.",
    defaultTargetId: "validation-orbiter",
    metadata: {
      source: "Analytic circular two-body fixture",
      sourceUrl: "local deterministic fixture",
      epoch: "J2000.0 (2000-01-01T12:00:00Z)",
      referenceFrame: "Barycentric Cartesian SI fixture",
      notes: `One 1 AU near-circular orbit with velocity derived from GM/r; intended for diagnostics, not astronomy.`,
    },
    createBodies: createTwoBodyValidation,
    orbitalBodies: [],
    belts: [],
  },
] as const;

export function findScenario(id: string): ScenarioDefinition {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0]!;
}

export const DEFAULT_FIXED_TIMESTEP_SECONDS = 3 * 3_600;
export const DEFAULT_MAX_STEPS_PER_FRAME = 80;
export const DEFAULT_TIME_SCALE_SECONDS = 30 * DAY_SECONDS;
