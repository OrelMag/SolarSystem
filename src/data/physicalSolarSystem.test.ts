import { describe, expect, it } from "vitest";
import { magnitude, subtract } from "../domain/vector";
import { calculateConservedQuantities, relativeDrift } from "../physics/diagnostics";
import { NBodySimulation } from "../physics/simulation";
import { createPhysicalSolarSystem } from "./physicalSolarSystem";

describe("createPhysicalSolarSystem", () => {
  it("creates the Sun, eight planets, Pluto, and 12 physical moons", () => {
    const bodies = createPhysicalSolarSystem();
    expect(bodies).toHaveLength(22);
    expect(new Set(bodies.map((body) => body.id)).size).toBe(22);
    expect(bodies.filter((body) => body.category === "moon")).toHaveLength(12);
    expect(bodies.find((body) => body.id === "pluto")?.category).toBe("dwarf-planet");
    for (const body of bodies) {
      expect(body.massKg).toBeGreaterThan(0);
      expect(body.radiusM).toBeGreaterThan(0);
      expect(Number.isFinite(body.positionM.x)).toBe(true);
      expect(Number.isFinite(body.velocityMps.y)).toBe(true);
    }
  });

  it("resolves every moon parent to a physical body", () => {
    const bodies = createPhysicalSolarSystem();
    const ids = new Set(bodies.map((body) => body.id));
    for (const moon of bodies.filter((body) => body.category === "moon")) {
      expect(moon.parentId, moon.id).toBeTruthy();
      expect(ids.has(moon.parentId!), moon.id).toBe(true);
    }
  });

  it("starts with near-zero total linear momentum after barycentric correction", () => {
    const bodies = createPhysicalSolarSystem();
    const conserved = calculateConservedQuantities(bodies);
    const momentumScale = bodies.reduce(
      (total, body) => total + magnitude(body.velocityMps) * body.massKg,
      0,
    );
    expect(magnitude(conserved.linearMomentumKgMps) / momentumScale).toBeLessThan(1e-14);
  });

  it("keeps close moon systems finite with the moon-capable timestep", () => {
    const simulation = new NBodySimulation(createPhysicalSolarSystem(), {
      fixedTimestepSeconds: 300,
      minimumDistanceM: 1_000,
    });
    const initial = calculateConservedQuantities(simulation.bodies);
    simulation.step(2_880);
    const final = calculateConservedQuantities(simulation.bodies);
    const byId = new Map(simulation.bodies.map((body) => [body.id, body] as const));
    const boundedDistance = (moonId: string, parentId: string, minimumM: number, maximumM: number) => {
      const moon = byId.get(moonId);
      const parent = byId.get(parentId);
      expect(moon).toBeDefined();
      expect(parent).toBeDefined();
      const distance = magnitude(subtract(moon!.positionM, parent!.positionM));
      expect(distance).toBeGreaterThan(minimumM);
      expect(distance).toBeLessThan(maximumM);
    };
    boundedDistance("moon", "earth", 300_000_000, 470_000_000);
    boundedDistance("phobos", "mars", 7_000_000, 13_000_000);
    expect(relativeDrift(final.energyJ, initial.energyJ)).toBeLessThan(2e-5);
    expect(
      relativeDrift(
        magnitude(final.angularMomentumKgM2ps),
        magnitude(initial.angularMomentumKgM2ps),
      ),
    ).toBeLessThan(1e-8);
  });

  it("resets the physical moon state exactly", () => {
    const simulation = new NBodySimulation(createPhysicalSolarSystem(), {
      fixedTimestepSeconds: 300,
      minimumDistanceM: 1_000,
    });
    const initial = simulation.snapshot;
    simulation.step(20);
    simulation.reset();
    expect(simulation.snapshot).toEqual(initial);
  });
});
