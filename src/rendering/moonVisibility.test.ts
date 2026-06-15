import { describe, expect, it } from "vitest";
import { shouldShowMoon } from "./moonVisibility";

const base = {
  enabled: true,
  cameraZoom: 10,
  thresholdZoom: 28,
  moonId: "europa",
  parentId: "jupiter",
  selectedBodyId: "sun",
};

describe("moon visibility", () => {
  it("shows moons at local-system zoom", () => {
    expect(shouldShowMoon({ ...base, cameraZoom: 28 })).toBe(true);
  });

  it("shows a selected moon system below the zoom threshold", () => {
    expect(shouldShowMoon({ ...base, selectedBodyId: "jupiter" })).toBe(true);
    expect(
      shouldShowMoon({
        ...base,
        selectedBodyId: "io",
        selectedParentId: "jupiter",
      }),
    ).toBe(true);
  });

  it("gives the master toggle precedence", () => {
    expect(
      shouldShowMoon({
        ...base,
        enabled: false,
        cameraZoom: 100,
        selectedBodyId: "europa",
      }),
    ).toBe(false);
  });
});
