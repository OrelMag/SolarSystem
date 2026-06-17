import { describe, expect, it } from "vitest";
import { DAY_SECONDS } from "../physics/constants";
import { estimateCurrentViewGifExport, normalizeGifExportOptions } from "./gifExport";

describe("GIF export estimates", () => {
  it("estimates a one-Earth-orbit current-view export at default dimensions", () => {
    const estimate = estimateCurrentViewGifExport({
      selectedBodyId: "earth",
      scenarioId: "full-solar-system",
      fixedTimestepSeconds: 300,
    });

    expect(estimate.selectedBodyId).toBe("earth");
    expect(estimate.fileName).toBe("solar-system-full-solar-system-earth-current-view.gif");
    expect(estimate.outputWidthPx).toBe(3440);
    expect(estimate.outputHeightPx).toBe(1440);
    expect(estimate.simulatedDurationSeconds).toBe(365.25 * DAY_SECONDS);
    expect(estimate.frameCount).toBe(180);
    expect(estimate.framesPerSecond).toBe(15);
    expect(estimate.frameDelayMs).toBe(67);
    expect(estimate.physicsStepCount).toBe(Math.ceil((365.25 * DAY_SECONDS) / 300));
  });

  it("allows stars and display-only selected ids", () => {
    expect(
      estimateCurrentViewGifExport({
        selectedBodyId: "sun",
        scenarioId: "full-solar-system",
        fixedTimestepSeconds: 300,
      }).fileName,
    ).toBe("solar-system-full-solar-system-sun-current-view.gif");

    expect(
      estimateCurrentViewGifExport({
        selectedBodyId: "halley",
        scenarioId: "full-solar-system",
        fixedTimestepSeconds: 300,
      }).fileName,
    ).toBe("solar-system-full-solar-system-halley-current-view.gif");
  });

  it("uses custom dimensions, duration, and confirmation options", () => {
    const estimate = estimateCurrentViewGifExport({
      selectedBodyId: "moon",
      scenarioId: "inner planets",
      fixedTimestepSeconds: 60,
      options: {
        outputWidthPx: 1920,
        outputHeightPx: 1080,
        frameCount: 30,
        framesPerSecond: 10,
        simulatedDurationSeconds: 8 * DAY_SECONDS,
        longExportStepThreshold: 10,
      },
    });

    expect(estimate.outputWidthPx).toBe(1920);
    expect(estimate.outputHeightPx).toBe(1080);
    expect(estimate.frameCount).toBe(30);
    expect(estimate.frameDelayMs).toBe(100);
    expect(estimate.simulatedDurationSeconds).toBe(691_200);
    expect(estimate.physicsStepCount).toBe(11_520);
    expect(estimate.requiresConfirmation).toBe(true);
    expect(estimate.fileName).toBe("solar-system-inner-planets-moon-current-view.gif");
  });

  it("normalizes invalid option values conservatively", () => {
    expect(
      normalizeGifExportOptions({
        frameCount: 1,
        framesPerSecond: 0,
        outputWidthPx: 1,
        outputHeightPx: Number.NaN,
        longExportStepThreshold: 0,
        simulatedDurationSeconds: Number.NaN,
      }),
    ).toEqual({
      frameCount: 2,
      framesPerSecond: 1,
      outputWidthPx: 320,
      outputHeightPx: 180,
      longExportStepThreshold: 1,
      simulatedDurationSeconds: 0,
    });
  });

  it("rejects invalid fixed timesteps", () => {
    expect(() =>
      estimateCurrentViewGifExport({
        selectedBodyId: "earth",
        scenarioId: "inner-planets",
        fixedTimestepSeconds: 0,
      }),
    ).toThrow(/positive fixed physics timestep/);
  });
});
