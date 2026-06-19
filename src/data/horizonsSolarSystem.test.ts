import { describe, expect, it } from "vitest";
import { magnitude } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";
import {
  createHorizonsSolarSystem,
  HORIZONS_SOLAR_DATASET_METADATA,
  horizonsQuerySummary,
} from "./horizonsSolarSystem";

describe("createHorizonsSolarSystem", () => {
  it("creates the Sun and eight planets from the checked-in Horizons snapshot", () => {
    const bodies = createHorizonsSolarSystem();

    expect(bodies).toHaveLength(9);
    expect(new Set(bodies.map((body) => body.id)).size).toBe(9);
    expect(bodies[0]?.id).toBe("sun");
    expect(bodies.filter((body) => body.category === "planet")).toHaveLength(8);
    expect(horizonsQuerySummary()).toContain("earth:399");
  });

  it("converts Horizons kilometres and kilometres per second to SI state vectors", () => {
    const earth = createHorizonsSolarSystem().find((body) => body.id === "earth");

    expect(earth).toBeDefined();
    expect(magnitude(earth!.positionM) / ASTRONOMICAL_UNIT_M).toBeGreaterThan(0.98);
    expect(magnitude(earth!.positionM) / ASTRONOMICAL_UNIT_M).toBeLessThan(1.02);
    expect(magnitude(earth!.velocityMps) / 1_000).toBeGreaterThan(29);
    expect(magnitude(earth!.velocityMps) / 1_000).toBeLessThan(31);
  });

  it("records source metadata, source units, and conversion details", () => {
    expect(HORIZONS_SOLAR_DATASET_METADATA.datasetId).toBe("jpl-horizons-cartesian-j2000");
    expect(HORIZONS_SOLAR_DATASET_METADATA.source).toContain("Horizons");
    expect(HORIZONS_SOLAR_DATASET_METADATA.sourceUrl).toContain("horizons");
    expect(HORIZONS_SOLAR_DATASET_METADATA.originalUnits).toContain("kilometres");
    expect(HORIZONS_SOLAR_DATASET_METADATA.conversionApplied).toContain("1,000");
  });
});
