import { describe, expect, it } from "vitest";
import { COMETS } from "./comets";
import { EXPLORATION_BODIES, MAJOR_MOONS, PLUTO } from "./satellites";
import { createSolarSystem } from "./solarSystem";
import {
  propagateHierarchicalBodies,
  validateOrbitalHierarchy,
} from "../physics/hierarchicalOrbits";
import { J2000_JULIAN_DAY } from "../physics/orbitalMechanics";
import { add, magnitude, subtract } from "../domain/vector";
import { NBodySimulation } from "../physics/simulation";

describe("planetary neighborhoods", () => {
  it("contains Pluto and the requested 12 uniquely identified moons", () => {
    expect(PLUTO.category).toBe("dwarf-planet");
    expect(MAJOR_MOONS).toHaveLength(12);
    expect(new Set(EXPLORATION_BODIES.map((body) => body.id)).size).toBe(13);
    expect(MAJOR_MOONS.map((moon) => moon.id)).toContain("charon");
    for (const body of EXPLORATION_BODIES) {
      expect(body.massKg).toBeGreaterThan(0);
      expect(body.radiusM).toBeGreaterThan(0);
      expect(body.source.url).toMatch(/^https:\/\/ssd\.jpl\.nasa\.gov/);
      expect(body.facts.significance.length).toBeGreaterThan(20);
    }
  });

  it("validates all parent references and metadata", () => {
    const massive = createSolarSystem();
    expect(() =>
      validateOrbitalHierarchy(
        [...COMETS, ...EXPLORATION_BODIES],
        massive.map((body) => body.id),
      ),
    ).not.toThrow();
  });

  it("composes planet-to-moon and Sun-to-Pluto-to-Charon states", () => {
    const massive = createSolarSystem();
    const states = propagateHierarchicalBodies(
      [...COMETS, ...EXPLORATION_BODIES],
      massive,
      J2000_JULIAN_DAY,
    );
    for (const id of ["moon", "charon"]) {
      const state = states.find((candidate) => candidate.body.id === id)!;
      expect(
        magnitude(
          subtract(
            state.positionM,
            add(state.parentPositionM, state.relativePositionM),
          ),
        ),
      ).toBeLessThan(0.01);
      expect(magnitude(state.relativePositionM)).toBeGreaterThan(1_000);
    }
    expect(states.find((state) => state.body.id === "charon")?.body.parentId).toBe("pluto");
  });

  it("remains finite over centuries without affecting massive-body integration", () => {
    const bodies = createSolarSystem();
    const baseline = new NBodySimulation(bodies, {
      fixedTimestepSeconds: 10_800,
      minimumDistanceM: 1_000,
    });
    const comparison = new NBodySimulation(bodies, {
      fixedTimestepSeconds: 10_800,
      minimumDistanceM: 1_000,
    });
    baseline.step(100);
    propagateHierarchicalBodies(
      [...COMETS, ...EXPLORATION_BODIES],
      baseline.bodies,
      J2000_JULIAN_DAY + 200 * 365.25,
    ).forEach((state) => {
      expect(Number.isFinite(state.positionM.x)).toBe(true);
      expect(Number.isFinite(state.velocityMps.y)).toBe(true);
    });
    comparison.step(100);
    expect(baseline.snapshot).toEqual(comparison.snapshot);
  });
});
