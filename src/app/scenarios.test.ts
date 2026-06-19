import { describe, expect, it } from "vitest";
import { SCENARIOS } from "./scenarios";

describe("scenarios", () => {
  it("creates unique massive bodies and complete metadata", () => {
    for (const scenario of SCENARIOS) {
      const bodies = scenario.createBodies();
      const ids = new Set(bodies.map((body) => body.id));
      expect(ids.size).toBe(bodies.length);
      expect(bodies.length).toBeGreaterThan(1);
      expect(scenario.metadata.source).toBeTruthy();
      expect(scenario.metadata.epoch).toBeTruthy();
      expect(scenario.metadata.referenceFrame).toBeTruthy();
      expect(scenario.metadata.datasetId).toBeTruthy();
      expect(scenario.metadata.originalUnits).toBeTruthy();
      expect(scenario.metadata.conversionApplied).toBeTruthy();
    }
  });

  it("keeps hierarchical bodies attached to known scenario parents", () => {
    for (const scenario of SCENARIOS) {
      const known = new Set(scenario.createBodies().map((body) => body.id));
      for (const body of scenario.displayOnlyOrbitalBodies) {
        expect(known.has(body.parentId), `${scenario.id}:${body.id}`).toBe(true);
        known.add(body.id);
      }
      for (const body of scenario.createBodies().filter((candidate) => candidate.parentId)) {
        expect(known.has(body.parentId!), `${scenario.id}:${body.id}`).toBe(true);
      }
    }
  });

  it("attaches the two-body validation orbiter to its primary", () => {
    const validation = SCENARIOS.find((scenario) => scenario.id === "two-body-validation");
    const orbiter = validation?.createBodies().find((body) => body.id === "validation-orbiter");

    expect(orbiter?.parentId).toBe("validation-primary");
  });
});
