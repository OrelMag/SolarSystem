import { describe, expect, it } from "vitest";
import type { CelestialBody } from "../domain/types";
import { magnitude, vector } from "../domain/vector";
import { calculateConservedQuantities, relativeDrift } from "./diagnostics";
import { GRAVITATIONAL_CONSTANT } from "./constants";
import { NBodySimulation } from "./simulation";

function createCircularBinary(): CelestialBody[] {
  const starMass = 1e26;
  const planetMass = 1e20;
  const distance = 1e9;
  const speed = Math.sqrt((GRAVITATIONAL_CONSTANT * starMass) / distance);
  return [
    {
      id: "star",
      name: "Star",
      category: "star",
      massKg: starMass,
      radiusM: 1e6,
      positionM: vector(0, 0, 0),
      velocityMps: vector(0, (-speed * planetMass) / starMass, 0),
      visual: { color: 0xffffff },
    },
    {
      id: "planet",
      name: "Planet",
      category: "planet",
      massKg: planetMass,
      radiusM: 1e4,
      positionM: vector(distance, 0, 0),
      velocityMps: vector(0, speed, 0),
      visual: { color: 0xffffff },
    },
  ];
}

describe("NBodySimulation", () => {
  it("advances time only by complete fixed steps", () => {
    const simulation = new NBodySimulation(createCircularBinary(), {
      fixedTimestepSeconds: 10,
      minimumDistanceM: 1,
    });
    simulation.step(3);
    expect(simulation.elapsedSeconds).toBe(30);
  });

  it("restores the exact initial state on reset", () => {
    const simulation = new NBodySimulation(createCircularBinary(), {
      fixedTimestepSeconds: 10,
      minimumDistanceM: 1,
    });
    const initial = simulation.snapshot;
    simulation.step(20);
    simulation.reset();
    expect(simulation.snapshot).toEqual(initial);
  });

  it("clones a snapshot without sharing mutable state", () => {
    const simulation = new NBodySimulation(createCircularBinary(), {
      fixedTimestepSeconds: 10,
      minimumDistanceM: 1,
    });
    simulation.step(3);
    const clone = NBodySimulation.fromSnapshot(simulation.snapshot, {
      fixedTimestepSeconds: 10,
      minimumDistanceM: 1,
    });

    expect(clone.elapsedSeconds).toBe(30);
    expect(clone.snapshot).toEqual(simulation.snapshot);

    clone.step();
    expect(clone.elapsedSeconds).toBe(40);
    expect(simulation.elapsedSeconds).toBe(30);
    expect(clone.snapshot).not.toEqual(simulation.snapshot);
  });

  it("keeps a circular orbit and conserved quantities bounded", () => {
    const simulation = new NBodySimulation(createCircularBinary(), {
      fixedTimestepSeconds: 200,
      minimumDistanceM: 1,
    });
    const initial = calculateConservedQuantities(simulation.bodies);
    const initialRadius = magnitude(simulation.bodies[1]?.positionM ?? vector());

    simulation.step(10_000);

    const final = calculateConservedQuantities(simulation.bodies);
    const finalRadius = magnitude(simulation.bodies[1]?.positionM ?? vector());
    expect(Math.abs(finalRadius - initialRadius) / initialRadius).toBeLessThan(2e-4);
    expect(relativeDrift(final.energyJ, initial.energyJ)).toBeLessThan(1e-8);
    expect(
      relativeDrift(
        magnitude(final.angularMomentumKgM2ps),
        magnitude(initial.angularMomentumKgM2ps),
      ),
    ).toBeLessThan(1e-10);
  });

  it("validates duplicate identifiers", () => {
    const bodies = createCircularBinary();
    const duplicate = { ...bodies[1]!, id: "star" };
    expect(
      () =>
        new NBodySimulation([bodies[0]!, duplicate], {
          fixedTimestepSeconds: 1,
          minimumDistanceM: 1,
        }),
    ).toThrow(/unique/);
  });

  it("adds and removes validated runtime bodies without changing the reset baseline", () => {
    const simulation = new NBodySimulation(createCircularBinary(), {
      fixedTimestepSeconds: 10,
      minimumDistanceM: 1,
    });
    const spacecraft: CelestialBody = {
      id: "spacecraft",
      name: "Spacecraft",
      category: "spacecraft",
      massKg: 1_000,
      radiusM: 10,
      positionM: vector(2e9, 0, 0),
      velocityMps: vector(0, 1_000, 0),
      visual: { color: 0x8ee8ff },
    };

    simulation.addRuntimeBody(spacecraft);
    expect(simulation.bodies.map((body) => body.id)).toContain("spacecraft");
    expect(() => simulation.addRuntimeBody(spacecraft)).toThrow(/unique/);
    expect(simulation.removeRuntimeBody("planet")).toBe(false);
    expect(simulation.removeRuntimeBody("spacecraft")).toBe(true);
    expect(simulation.bodies.map((body) => body.id)).not.toContain("spacecraft");

    simulation.addRuntimeBody(spacecraft);
    simulation.reset();
    expect(simulation.bodies.map((body) => body.id)).toEqual(["star", "planet"]);
  });

  it("validates runtime body state", () => {
    const simulation = new NBodySimulation(createCircularBinary(), {
      fixedTimestepSeconds: 10,
      minimumDistanceM: 1,
    });

    expect(() =>
      simulation.addRuntimeBody({
        id: "spacecraft",
        name: "Spacecraft",
        category: "spacecraft",
        massKg: 0,
        radiusM: 10,
        positionM: vector(0, 0, 0),
        velocityMps: vector(0, 0, 0),
        visual: { color: 0x8ee8ff },
      }),
    ).toThrow(/positive mass/);
  });
});
