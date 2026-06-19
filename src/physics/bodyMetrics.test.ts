import { describe, expect, it } from "vitest";
import { ASTRONOMICAL_UNIT_M, JULIAN_YEAR_SECONDS } from "./constants";
import { calculateBodyScientificMetrics } from "./bodyMetrics";

describe("calculateBodyScientificMetrics", () => {
  it("derives parent-relative distance, speed, and bound orbit estimates", () => {
    const sun = {
      id: "sun",
      name: "Sun",
      category: "star" as const,
      massKg: 1.988_47e30,
      radiusM: 696_340_000,
      positionM: { x: 0, y: 0, z: 0 },
      velocityMps: { x: 0, y: 0, z: 0 },
      visual: { color: 0xffd279 },
    };
    const earth = {
      id: "earth",
      name: "Earth",
      category: "planet" as const,
      massKg: 5.972_19e24,
      radiusM: 6_371_000,
      positionM: { x: ASTRONOMICAL_UNIT_M, y: 0, z: 0 },
      velocityMps: { x: 0, y: 29_784.7, z: 0 },
      visual: { color: 0x4c86d9 },
    };

    const metrics = calculateBodyScientificMetrics({ body: earth, bodies: [sun, earth] });

    expect(metrics.centralBodyId).toBe("sun");
    expect(metrics.distanceFromCentralM).toBe(ASTRONOMICAL_UNIT_M);
    expect(metrics.relativeSpeedMps).toBe(29_784.7);
    expect(metrics.orbitalPeriodSeconds! / JULIAN_YEAR_SECONDS).toBeCloseTo(1, 2);
    expect(metrics.periapsisM).toBeGreaterThan(0.98 * ASTRONOMICAL_UNIT_M);
    expect(metrics.apoapsisM).toBeLessThan(1.02 * ASTRONOMICAL_UNIT_M);
  });

  it("uses explicit parent bodies for moons", () => {
    const earth = {
      id: "earth",
      name: "Earth",
      category: "planet" as const,
      massKg: 5.972_19e24,
      radiusM: 6_371_000,
      positionM: { x: ASTRONOMICAL_UNIT_M, y: 0, z: 0 },
      velocityMps: { x: 0, y: 29_784.7, z: 0 },
      visual: { color: 0x4c86d9 },
    };
    const moon = {
      id: "moon",
      name: "Moon",
      category: "moon" as const,
      parentId: "earth",
      massKg: 7.342e22,
      radiusM: 1_737_400,
      positionM: { x: ASTRONOMICAL_UNIT_M + 384_400_000, y: 0, z: 0 },
      velocityMps: { x: 0, y: 29_784.7 + 1_022, z: 0 },
      visual: { color: 0xd5d2ca },
    };

    const metrics = calculateBodyScientificMetrics({ body: moon, bodies: [earth, moon] });

    expect(metrics.centralBodyId).toBe("earth");
    expect(metrics.distanceFromCentralM).toBe(384_400_000);
    expect(metrics.relativeSpeedMps).toBe(1_022);
    expect(metrics.orbitalPeriodSeconds).toBeGreaterThan(27 * 86_400);
    expect(metrics.orbitalPeriodSeconds).toBeLessThan(28 * 86_400);
  });
});
