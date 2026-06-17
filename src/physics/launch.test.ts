import { describe, expect, it } from "vitest";
import { createPhysicalSolarSystem } from "../data/physicalSolarSystem";
import type { CelestialBody } from "../domain/types";
import { magnitude, subtract, vector } from "../domain/vector";
import {
  ACTIVE_SPACECRAFT_ID,
  SPACECRAFT_LAUNCH_ALTITUDE_M,
  createEarthLaunch,
} from "./launch";

describe("createEarthLaunch", () => {
  it("rejects scenarios without Earth", () => {
    const bodies: CelestialBody[] = [
      {
        id: "sun",
        name: "Sun",
        category: "star",
        massKg: 1.988e30,
        radiusM: 696_340_000,
        positionM: vector(),
        velocityMps: vector(),
        visual: { color: 0xffffff },
      },
    ];

    expect(() =>
      createEarthLaunch({
        bodies,
        target: {
          id: "mars",
          name: "Mars",
          massKg: 6.4e23,
          radiusM: 3_389_500,
          positionM: vector(2e11, 0, 0),
          velocityMps: vector(0, 24_000, 0),
        },
      }),
    ).toThrow(/requires Earth/);
  });

  it("creates a finite Earth-to-Moon spacecraft outside Earth radius", () => {
    const bodies = createPhysicalSolarSystem();
    const earth = bodies.find((body) => body.id === "earth");
    const moon = bodies.find((body) => body.id === "moon");
    expect(earth).toBeDefined();
    expect(moon).toBeDefined();

    const launch = createEarthLaunch({ bodies, target: moon! });
    const parkingDistance = magnitude(subtract(launch.spacecraft.positionM, earth!.positionM));

    expect(launch.spacecraft.id).toBe(ACTIVE_SPACECRAFT_ID);
    expect(launch.spacecraft.category).toBe("spacecraft");
    expect(launch.spacecraft.parentId).toBe("earth");
    expect(Math.abs(parkingDistance - (earth!.radiusM + SPACECRAFT_LAUNCH_ALTITUDE_M))).toBeLessThan(1);
    expect(Number.isFinite(magnitude(launch.spacecraft.velocityMps))).toBe(true);
    expect(launch.estimatedTransferSeconds).toBeGreaterThan(0);
    expect(launch.transferKind).toBe("earth-moon");
  });

  it("creates a distinct interplanetary transfer estimate", () => {
    const bodies = createPhysicalSolarSystem();
    const mars = bodies.find((body) => body.id === "mars");
    expect(mars).toBeDefined();

    const launch = createEarthLaunch({ bodies, target: mars! });

    expect(launch.spacecraft.parentId).toBeUndefined();
    expect(launch.transferKind).toBe("interplanetary");
    expect(launch.estimatedTransferSeconds).toBeGreaterThan(10_000_000);
    expect(launch.injectionSpeedMps).toBeGreaterThan(10_000);
  });
});
