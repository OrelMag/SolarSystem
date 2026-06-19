import { describe, expect, it } from "vitest";
import { DAY_SECONDS, JULIAN_YEAR_SECONDS } from "../physics/constants";
import { calculatePhysicsStepBudget } from "./simulationClock";

describe("simulation clock step budget", () => {
  it("keeps the default speed near the base frame budget", () => {
    expect(
      calculatePhysicsStepBudget({
        timeScaleSeconds: 7 * DAY_SECONDS,
        fixedTimestepSeconds: 300,
        baseMaxStepsPerFrame: 80,
      }),
    ).toBe(80);
  });

  it("allows high custom speeds above the old 80-step ceiling", () => {
    const budget = calculatePhysicsStepBudget({
      timeScaleSeconds: JULIAN_YEAR_SECONDS,
      fixedTimestepSeconds: 300,
      baseMaxStepsPerFrame: 80,
    });

    expect(budget).toBeGreaterThan(80);
    expect(budget).toBeLessThanOrEqual(2_400);
  });

  it("still clamps extreme fast-forward values", () => {
    expect(
      calculatePhysicsStepBudget({
        timeScaleSeconds: 100 * JULIAN_YEAR_SECONDS,
        fixedTimestepSeconds: 300,
        baseMaxStepsPerFrame: 80,
        fastForwardMaxStepsPerFrame: 1_200,
      }),
    ).toBe(1_200);
  });
});
