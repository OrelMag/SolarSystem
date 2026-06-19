import { describe, expect, it } from "vitest";
import { add, magnitude, scale, subtract, vector } from "../domain/vector";
import { calculateSpacecraftGuidance } from "./guidance";
import type { LaunchTargetState } from "./launch";

const target: LaunchTargetState = {
  id: "mars",
  name: "Mars",
  massKg: 1,
  radiusM: 1_000,
  positionM: vector(1_000_000, 0, 0),
  velocityMps: vector(),
};

describe("spacecraft guidance", () => {
  it("computes a bounded correction that reduces target distance", () => {
    const spacecraft = {
      positionM: vector(0, 0, 0),
      velocityMps: vector(),
    };
    const guidance = calculateSpacecraftGuidance({
      spacecraft,
      target,
      config: {
        fixedTimestepSeconds: 10,
        arrivalThresholdM: 1_000,
        maxAccelerationMps2: 0.5,
        maxCruiseSpeedMps: 10_000,
      },
    });
    const nextVelocity = add(spacecraft.velocityMps, guidance.deltaVelocityMps);
    const nextPosition = add(spacecraft.positionM, scale(nextVelocity, 10));

    expect(guidance.mode).toBe("guided");
    expect(magnitude(guidance.deltaVelocityMps)).toBeLessThanOrEqual(5);
    expect(magnitude(subtract(target.positionM, nextPosition))).toBeLessThan(
      magnitude(subtract(target.positionM, spacecraft.positionM)),
    );
  });

  it("switches to station keeping inside the arrival threshold", () => {
    const guidance = calculateSpacecraftGuidance({
      spacecraft: {
        positionM: vector(999_500, 0, 0),
        velocityMps: vector(1, 0, 0),
      },
      target,
      config: {
        fixedTimestepSeconds: 10,
        arrivalThresholdM: 1_000,
        maxAccelerationMps2: 0.5,
        maxCruiseSpeedMps: 10_000,
      },
    });

    expect(guidance.arrived).toBe(true);
    expect(guidance.mode).toBe("station-keeping");
    expect(guidance.deltaVelocityMps.x).toBeLessThan(0);
  });
});
