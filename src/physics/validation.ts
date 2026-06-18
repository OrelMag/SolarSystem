import type { CelestialBody } from "../domain/types";
import { magnitude, vector } from "../domain/vector";
import { calculateConservedQuantities, relativeDrift } from "./diagnostics";
import { GRAVITATIONAL_CONSTANT, JULIAN_YEAR_SECONDS } from "./constants";
import { NBodySimulation, type SimulationConfig } from "./simulation";

export interface ConservationValidationCase {
  readonly id: "one-year" | "ten-years" | "one-hundred-years";
  readonly simulatedYears: number;
  readonly fixedTimestepSeconds: number;
  readonly maximumEnergyDrift: number;
  readonly maximumAngularMomentumDrift: number;
}

export interface ConservationValidationResult {
  readonly caseId: ConservationValidationCase["id"];
  readonly stepCount: number;
  readonly elapsedSeconds: number;
  readonly energyDrift: number;
  readonly angularMomentumDrift: number;
  readonly passed: boolean;
}

export const CONSERVATION_VALIDATION_CASES: readonly ConservationValidationCase[] = [
  {
    id: "one-year",
    simulatedYears: 1,
    fixedTimestepSeconds: 3_600,
    maximumEnergyDrift: 1e-8,
    maximumAngularMomentumDrift: 1e-12,
  },
  {
    id: "ten-years",
    simulatedYears: 10,
    fixedTimestepSeconds: 3_600,
    maximumEnergyDrift: 1e-8,
    maximumAngularMomentumDrift: 1e-12,
  },
  {
    id: "one-hundred-years",
    simulatedYears: 100,
    fixedTimestepSeconds: 3_600,
    maximumEnergyDrift: 1e-8,
    maximumAngularMomentumDrift: 1e-12,
  },
] as const;

export function createConservationValidationBodies(): CelestialBody[] {
  const primaryMassKg = 1e26;
  const orbiterMassKg = 1e20;
  const distanceM = 1e9;
  const speedMps = Math.sqrt((GRAVITATIONAL_CONSTANT * primaryMassKg) / distanceM);

  return [
    {
      id: "validation-primary",
      name: "Validation Primary",
      category: "star",
      massKg: primaryMassKg,
      radiusM: 1e6,
      positionM: vector(0, 0, 0),
      velocityMps: vector(0, (-speedMps * orbiterMassKg) / primaryMassKg, 0),
      visual: { color: 0xffffff },
    },
    {
      id: "validation-orbiter",
      name: "Validation Orbiter",
      category: "planet",
      massKg: orbiterMassKg,
      radiusM: 1e4,
      positionM: vector(distanceM, 0, 0),
      velocityMps: vector(0, speedMps, 0),
      visual: { color: 0xffffff },
    },
  ];
}

export function runConservationValidation(
  validationCase: ConservationValidationCase,
  config: Pick<SimulationConfig, "minimumDistanceM"> = { minimumDistanceM: 1 },
): ConservationValidationResult {
  const simulation = new NBodySimulation(createConservationValidationBodies(), {
    fixedTimestepSeconds: validationCase.fixedTimestepSeconds,
    minimumDistanceM: config.minimumDistanceM,
  });
  const initial = calculateConservedQuantities(simulation.bodies);
  const stepCount = Math.round(
    (validationCase.simulatedYears * JULIAN_YEAR_SECONDS) /
      validationCase.fixedTimestepSeconds,
  );

  simulation.step(stepCount);

  const final = calculateConservedQuantities(simulation.bodies);
  const energyDrift = relativeDrift(final.energyJ, initial.energyJ);
  const angularMomentumDrift = relativeDrift(
    magnitude(final.angularMomentumKgM2ps),
    magnitude(initial.angularMomentumKgM2ps),
  );

  return {
    caseId: validationCase.id,
    stepCount,
    elapsedSeconds: simulation.elapsedSeconds,
    energyDrift,
    angularMomentumDrift,
    passed:
      energyDrift <= validationCase.maximumEnergyDrift &&
      angularMomentumDrift <= validationCase.maximumAngularMomentumDrift,
  };
}
