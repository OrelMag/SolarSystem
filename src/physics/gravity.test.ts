import { describe, expect, it } from "vitest";
import type { CelestialBody } from "../domain/types";
import { vector } from "../domain/vector";
import { GRAVITATIONAL_CONSTANT } from "./constants";
import { calculateAccelerations } from "./gravity";

function body(id: string, massKg: number, x: number): CelestialBody {
  return {
    id,
    name: id,
    category: "planet",
    massKg,
    radiusM: 1,
    positionM: vector(x, 0, 0),
    velocityMps: vector(),
    visual: { color: 0xffffff },
  };
}

describe("calculateAccelerations", () => {
  it("calculates Newtonian acceleration in the correct direction", () => {
    const distance = 10;
    const mass = 20;
    const result = calculateAccelerations([body("a", 5, 0), body("b", mass, distance)]);

    expect(result[0]?.x).toBeCloseTo((GRAVITATIONAL_CONSTANT * mass) / distance ** 2, 15);
    expect(result[0]?.y).toBe(0);
    expect(result[1]?.x).toBeLessThan(0);
  });

  it("preserves equal-and-opposite pairwise force", () => {
    const first = body("a", 2, -3);
    const second = body("b", 7, 5);
    const result = calculateAccelerations([first, second]);
    const forceA = (result[0]?.x ?? 0) * first.massKg;
    const forceB = (result[1]?.x ?? 0) * second.massKg;

    expect(forceA + forceB).toBeCloseTo(0, 20);
  });

  it("rejects overlapping bodies", () => {
    expect(() =>
      calculateAccelerations([body("a", 1, 0), body("b", 1, 0)], 0.1),
    ).toThrow(/too close/);
  });
});
