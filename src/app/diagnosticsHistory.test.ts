import { describe, expect, it } from "vitest";
import { DiagnosticsHistory, calculateCenterOfMass, sparkline } from "./diagnosticsHistory";

describe("diagnostics history", () => {
  it("keeps a bounded sample history and reports warning thresholds", () => {
    const history = new DiagnosticsHistory();
    for (let index = 0; index < 120; index += 1) {
      history.add({
        elapsedSeconds: index,
        energyDrift: index / 1_000,
        angularMomentumDrift: index / 2_000,
      });
    }
    const status = history.status({
      bodies: [],
      current: {
        energyJ: 0,
        linearMomentumKgMps: { x: 3, y: 4, z: 0 },
        angularMomentumKgM2ps: { x: 0, y: 0, z: 12 },
      },
      energyWarningDrift: 0.01,
      angularMomentumWarningDrift: 0.01,
    });
    expect(status.samples).toHaveLength(96);
    expect(status.warning).toBe(true);
    expect(status.linearMomentumMagnitude).toBe(5);
    expect(status.angularMomentumMagnitude).toBe(12);
    expect(sparkline(status.samples, "energyDrift").length).toBe(96);
  });

  it("calculates center of mass from massive body positions", () => {
    expect(
      calculateCenterOfMass([
        {
          id: "a",
          name: "A",
          category: "star",
          massKg: 3,
          radiusM: 1,
          positionM: { x: 0, y: 0, z: 0 },
          velocityMps: { x: 0, y: 0, z: 0 },
          visual: { color: 0 },
        },
        {
          id: "b",
          name: "B",
          category: "planet",
          massKg: 1,
          radiusM: 1,
          positionM: { x: 4, y: 0, z: 0 },
          velocityMps: { x: 0, y: 0, z: 0 },
          visual: { color: 0 },
        },
      ]),
    ).toEqual({ x: 1, y: 0, z: 0 });
  });
});
