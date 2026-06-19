import { describe, expect, it } from "vitest";
import { SCENARIOS } from "./scenarios";
import { formatDatasetNotes } from "./datasetPanel";

describe("formatDatasetNotes", () => {
  it("includes description, units, and conversion details", () => {
    const scenario = SCENARIOS[0]!;
    const notes = formatDatasetNotes(scenario);

    expect(notes).toContain(scenario.description);
    expect(notes).toContain(scenario.metadata.originalUnits);
    expect(notes).toContain(scenario.metadata.conversionApplied);
  });
});
