import { describe, expect, it } from "vitest";
import { createPhysicalSolarSystem } from "../data/physicalSolarSystem";
import type { CelestialBody } from "../domain/types";
import { magnitude, subtract, vector } from "../domain/vector";
import {
  calculateSpacecraftGuidance,
  DEFAULT_SPACECRAFT_GUIDANCE,
} from "./guidance";
import { createMinimumDistanceCollisionPolicy } from "./collisionPolicy";
import {
  ACTIVE_SPACECRAFT_ID,
  SPACECRAFT_LAUNCH_ALTITUDE_M,
  createEarthLaunch,
} from "./launch";
import { NBodySimulation } from "./simulation";

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

  it("guides an Earth-to-Moon mission closer to the target", () => {
    const bodies = createPhysicalSolarSystem();
    const moon = bodies.find((body) => body.id === "moon");
    expect(moon).toBeDefined();

    const { initialDistanceM, finalDistanceM } = simulateGuidedLaunch({
      bodies,
      targetId: "moon",
      stepCount: 900,
      arrivalThresholdM: 25_000_000,
    });

    expect(finalDistanceM).toBeLessThan(initialDistanceM);
  });

  it("guides an Earth-to-Mars mission closer to the target", () => {
    const bodies = createPhysicalSolarSystem();
    const mars = bodies.find((body) => body.id === "mars");
    expect(mars).toBeDefined();

    const { initialDistanceM, finalDistanceM } = simulateGuidedLaunch({
      bodies,
      targetId: "mars",
      stepCount: 2_000,
      arrivalThresholdM: 25_000_000,
    });

    expect(finalDistanceM).toBeLessThan(initialDistanceM);
  });
});

function simulateGuidedLaunch(input: {
  readonly bodies: ReturnType<typeof createPhysicalSolarSystem>;
  readonly targetId: string;
  readonly stepCount: number;
  readonly arrivalThresholdM: number;
}): { readonly initialDistanceM: number; readonly finalDistanceM: number } {
  const target = input.bodies.find((body) => body.id === input.targetId);
  if (!target) throw new Error(`Missing target ${input.targetId}.`);
  const launch = createEarthLaunch({ bodies: input.bodies, target });
  const simulation = new NBodySimulation(input.bodies, {
    fixedTimestepSeconds: 300,
    collisionPolicy: createMinimumDistanceCollisionPolicy(1_000),
  });
  simulation.addRuntimeBody(launch.spacecraft);
  let spacecraft = simulation.bodies.find((body) => body.id === ACTIVE_SPACECRAFT_ID);
  if (!spacecraft) throw new Error("Missing spacecraft.");
  let currentTarget = simulation.bodies.find((body) => body.id === input.targetId);
  if (!currentTarget) throw new Error("Missing target in simulation.");
  const initialDistanceM = magnitude(subtract(spacecraft.positionM, currentTarget.positionM));

  for (let index = 0; index < input.stepCount; index += 1) {
    spacecraft = simulation.bodies.find((body) => body.id === ACTIVE_SPACECRAFT_ID);
    currentTarget = simulation.bodies.find((body) => body.id === input.targetId);
    if (!spacecraft || !currentTarget) throw new Error("Missing mission body.");
    const guidance = calculateSpacecraftGuidance({
      spacecraft,
      target: currentTarget,
      config: {
        fixedTimestepSeconds: simulation.fixedTimestepSeconds,
        arrivalThresholdM: input.arrivalThresholdM,
        maxAccelerationMps2: DEFAULT_SPACECRAFT_GUIDANCE.maxAccelerationMps2,
        maxCruiseSpeedMps: DEFAULT_SPACECRAFT_GUIDANCE.maxCruiseSpeedMps,
      },
    });
    simulation.applyRuntimeBodyVelocityDelta(ACTIVE_SPACECRAFT_ID, guidance.deltaVelocityMps);
    simulation.step();
  }

  spacecraft = simulation.bodies.find((body) => body.id === ACTIVE_SPACECRAFT_ID);
  currentTarget = simulation.bodies.find((body) => body.id === input.targetId);
  if (!spacecraft || !currentTarget) throw new Error("Missing final mission body.");
  return {
    initialDistanceM,
    finalDistanceM: magnitude(subtract(spacecraft.positionM, currentTarget.positionM)),
  };
}
