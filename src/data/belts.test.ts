import { describe, expect, it } from "vitest";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";
import { BELT_DEFINITIONS, generateBeltParticles } from "./belts";

describe("particle belts", () => {
  it("generates the configured number of deterministic particles", () => {
    for (const definition of BELT_DEFINITIONS) {
      const first = generateBeltParticles(definition);
      const second = generateBeltParticles(definition);
      expect(first).toHaveLength(definition.count);
      expect(second).toEqual(first);
    }
  });

  it("keeps particles in bounds and preserves configured Kirkwood gaps", () => {
    const definition = BELT_DEFINITIONS.find((belt) => belt.id === "main-belt")!;
    const particles = generateBeltParticles(definition);
    for (const particle of particles) {
      const semiMajorAxisAu = particle.elements.semiMajorAxisM / ASTRONOMICAL_UNIT_M;
      expect(semiMajorAxisAu).toBeGreaterThanOrEqual(definition.minimumSemiMajorAxisAu);
      expect(semiMajorAxisAu).toBeLessThanOrEqual(definition.maximumSemiMajorAxisAu);
      for (const gap of definition.excludedSemiMajorAxisAu ?? []) {
        expect(Math.abs(semiMajorAxisAu - gap.center)).toBeGreaterThanOrEqual(gap.halfWidth);
      }
    }
  });
});
