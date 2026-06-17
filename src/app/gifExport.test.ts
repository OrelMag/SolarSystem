import { describe, expect, it } from "vitest";
import type { CelestialBody } from "../domain/types";
import { vector } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M, DAY_SECONDS, GRAVITATIONAL_CONSTANT } from "../physics/constants";
import { NBodySimulation } from "../physics/simulation";
import { estimateSelectedOrbitGifExport, resolveCentralBody } from "./gifExport";

const sunMassKg = 1.988_47e30;
const earthMassKg = 5.972_19e24;
const moonMassKg = 7.342e22;

function body(input: Partial<CelestialBody> & Pick<CelestialBody, "id" | "name" | "category">): CelestialBody {
  return {
    massKg: 1,
    radiusM: 1,
    positionM: vector(),
    velocityMps: vector(),
    visual: { color: 0xffffff },
    ...input,
  };
}

function simulationFor(bodies: readonly CelestialBody[]): NBodySimulation {
  return new NBodySimulation(bodies, {
    fixedTimestepSeconds: 300,
    minimumDistanceM: 1,
  });
}

function circularSpeed(centralMassKg: number, radiusM: number): number {
  return Math.sqrt((GRAVITATIONAL_CONSTANT * centralMassKg) / radiusM);
}

describe("GIF export estimates", () => {
  it("derives a selected planet orbit and output settings", () => {
    const simulation = simulationFor([
      body({
        id: "sun",
        name: "Sun",
        category: "star",
        massKg: sunMassKg,
        radiusM: 696_340_000,
      }),
      body({
        id: "earth",
        name: "Earth",
        category: "planet",
        massKg: earthMassKg,
        radiusM: 6_371_000,
        positionM: vector(ASTRONOMICAL_UNIT_M, 0, 0),
        velocityMps: vector(0, circularSpeed(sunMassKg, ASTRONOMICAL_UNIT_M), 0),
      }),
    ]);

    const estimate = estimateSelectedOrbitGifExport({
      selectedBodyId: "earth",
      scenarioId: "full-solar-system",
      simulation,
    });

    expect(estimate.centralBodyId).toBe("sun");
    expect(estimate.fileName).toBe("solar-system-full-solar-system-earth-orbit.gif");
    expect(estimate.frameCount).toBe(180);
    expect(estimate.framesPerSecond).toBe(15);
    expect(estimate.frameDelayMs).toBe(67);
    expect(estimate.periodSeconds / DAY_SECONDS).toBeGreaterThan(360);
    expect(estimate.periodSeconds / DAY_SECONDS).toBeLessThan(370);
    expect(estimate.physicsStepCount).toBe(Math.ceil(estimate.periodSeconds / 300));
  });

  it("uses an explicit parent as the central body", () => {
    const earth = body({
      id: "earth",
      name: "Earth",
      category: "planet",
      massKg: earthMassKg,
      radiusM: 6_371_000,
      positionM: vector(ASTRONOMICAL_UNIT_M, 0, 0),
      velocityMps: vector(0, circularSpeed(sunMassKg, ASTRONOMICAL_UNIT_M), 0),
    });
    const moonRadiusM = 384_400_000;
    const simulation = simulationFor([
      body({ id: "sun", name: "Sun", category: "star", massKg: sunMassKg }),
      earth,
      body({
        id: "moon",
        name: "Moon",
        category: "moon",
        parentId: "earth",
        massKg: moonMassKg,
        radiusM: 1_737_400,
        positionM: vector(ASTRONOMICAL_UNIT_M + moonRadiusM, 0, 0),
        velocityMps: vector(
          0,
          circularSpeed(sunMassKg, ASTRONOMICAL_UNIT_M) +
            circularSpeed(earthMassKg, moonRadiusM),
          0,
        ),
      }),
    ]);

    expect(
      estimateSelectedOrbitGifExport({
        selectedBodyId: "moon",
        scenarioId: "full-solar-system",
        simulation,
      }).centralBodyId,
    ).toBe("earth");
  });

  it("flags long exports from the configured threshold", () => {
    const simulation = simulationFor([
      body({ id: "sun", name: "Sun", category: "star", massKg: sunMassKg }),
      body({
        id: "slow",
        name: "Slow",
        category: "planet",
        massKg: earthMassKg,
        positionM: vector(5 * ASTRONOMICAL_UNIT_M, 0, 0),
        velocityMps: vector(0, circularSpeed(sunMassKg, 5 * ASTRONOMICAL_UNIT_M), 0),
      }),
    ]);

    expect(
      estimateSelectedOrbitGifExport({
        selectedBodyId: "slow",
        scenarioId: "outer",
        simulation,
        options: { longExportStepThreshold: 10 },
      }).requiresConfirmation,
    ).toBe(true);
  });

  it("rejects stars, missing parents, display-only ids, and unbound states", () => {
    const sun = body({ id: "sun", name: "Sun", category: "star", massKg: sunMassKg });
    const planet = body({
      id: "planet",
      name: "Planet",
      category: "planet",
      massKg: earthMassKg,
      positionM: vector(ASTRONOMICAL_UNIT_M, 0, 0),
      velocityMps: vector(0, circularSpeed(sunMassKg, ASTRONOMICAL_UNIT_M), 0),
    });
    const simulation = simulationFor([sun, planet]);

    expect(() =>
      estimateSelectedOrbitGifExport({ selectedBodyId: "sun", scenarioId: "s", simulation }),
    ).toThrow(/Select a planet/);
    expect(() =>
      estimateSelectedOrbitGifExport({ selectedBodyId: "halley", scenarioId: "s", simulation }),
    ).toThrow(/physical N-body/);

    const missingParentSimulation = simulationFor([
      sun,
      { ...planet, id: "moon", parentId: "absent", category: "moon" },
    ]);
    expect(() =>
      estimateSelectedOrbitGifExport({
        selectedBodyId: "moon",
        scenarioId: "s",
        simulation: missingParentSimulation,
      }),
    ).toThrow(/parent/);

    const unboundSimulation = simulationFor([
      sun,
      {
        ...planet,
        velocityMps: vector(0, 2 * circularSpeed(sunMassKg, ASTRONOMICAL_UNIT_M), 0),
      },
    ]);
    expect(() =>
      estimateSelectedOrbitGifExport({
        selectedBodyId: "planet",
        scenarioId: "s",
        simulation: unboundSimulation,
      }),
    ).toThrow(/bounded elliptical/);
  });

  it("falls back to the most massive non-selected star if no sun exists", () => {
    const primary = body({ id: "primary", name: "Primary", category: "star", massKg: sunMassKg });
    const secondary = body({
      id: "secondary",
      name: "Secondary",
      category: "star",
      massKg: sunMassKg * 0.5,
    });
    const planet = body({ id: "planet", name: "Planet", category: "planet" });

    expect(resolveCentralBody(planet, [secondary, planet, primary]).id).toBe("primary");
  });
});
