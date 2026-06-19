import { describe, expect, it } from "vitest";
import { isFiniteVector, magnitude, subtract } from "../domain/vector";
import { createMinimumDistanceCollisionPolicy } from "../physics/collisionPolicy";
import { calculateConservedQuantities, relativeDrift } from "../physics/diagnostics";
import { NBodySimulation } from "../physics/simulation";
import {
  createHorizonsExtendedSolarSystem,
  HORIZONS_EXTENDED_SOLAR_DATASET_METADATA,
  horizonsExtendedQuerySummary,
} from "./horizonsExtendedSolarSystem";

describe("createHorizonsExtendedSolarSystem", () => {
  it("creates the Sun, eight planets, Pluto, and 12 major moons", () => {
    const bodies = createHorizonsExtendedSolarSystem();
    const ids = new Set(bodies.map((body) => body.id));

    expect(bodies).toHaveLength(22);
    expect(ids.size).toBe(22);
    expect(bodies.filter((body) => body.category === "planet")).toHaveLength(8);
    expect(bodies.filter((body) => body.category === "moon")).toHaveLength(12);
    expect(bodies.find((body) => body.id === "pluto")?.category).toBe("dwarf-planet");
    for (const body of bodies) {
      expect(body.massKg, body.id).toBeGreaterThan(0);
      expect(body.radiusM, body.id).toBeGreaterThan(0);
      expect(isFiniteVector(body.positionM), body.id).toBe(true);
      expect(isFiniteVector(body.velocityMps), body.id).toBe(true);
    }
  });

  it("resolves moon and Pluto parent references to physical bodies", () => {
    const bodies = createHorizonsExtendedSolarSystem();
    const ids = new Set(bodies.map((body) => body.id));

    for (const body of bodies.filter((candidate) => candidate.parentId)) {
      expect(ids.has(body.parentId!), body.id).toBe(true);
    }
  });

  it("converts checked Horizons source vectors to SI", () => {
    const byId = new Map(createHorizonsExtendedSolarSystem().map((body) => [body.id, body]));

    expect(byId.get("moon")?.positionM.x).toBeCloseTo(-27_858_348.866_999_16 * 1_000, 0);
    expect(byId.get("moon")?.velocityMps.y).toBeCloseTo(-6.213_103_678_165_645 * 1_000, 10);
    expect(byId.get("pluto")?.positionM.z).toBeCloseTo(875_246_342.612_255_5 * 1_000, 0);
    expect(byId.get("charon")?.velocityMps.z).toBeCloseTo(-1.090_460_026_696_852 * 1_000, 10);
    expect(magnitude(subtract(byId.get("moon")!.positionM, byId.get("earth")!.positionM))).toBeGreaterThan(
      350_000_000,
    );
  });

  it("records source metadata and Horizons command coverage", () => {
    expect(HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.datasetId).toBe(
      "jpl-horizons-extended-cartesian-j2000",
    );
    expect(HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.source).toContain("Horizons");
    expect(HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.originalUnits).toContain("kilometres");
    expect(HORIZONS_EXTENDED_SOLAR_DATASET_METADATA.conversionApplied).toContain("1,000");
    expect(horizonsExtendedQuerySummary()).toContain("charon:901");
  });

  it("keeps the extended Horizons state finite over a short conservation smoke run", () => {
    const simulation = new NBodySimulation(createHorizonsExtendedSolarSystem(), {
      fixedTimestepSeconds: 300,
      collisionPolicy: createMinimumDistanceCollisionPolicy(1_000),
    });
    const initial = calculateConservedQuantities(simulation.bodies);

    simulation.step(2_880);

    const final = calculateConservedQuantities(simulation.bodies);
    expect(relativeDrift(final.energyJ, initial.energyJ)).toBeLessThan(2e-5);
    expect(
      relativeDrift(
        magnitude(final.angularMomentumKgM2ps),
        magnitude(initial.angularMomentumKgM2ps),
      ),
    ).toBeLessThan(1e-8);
  });
});
