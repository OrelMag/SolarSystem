import { describe, expect, it } from "vitest";
import { shouldShowCometVisual } from "./cometVisibility";

describe("comet visibility", () => {
  it("uses the master toggle for all comet visuals", () => {
    for (const kind of ["body", "path", "tail"] as const) {
      expect(
        shouldShowCometVisual({
          kind,
          cometsVisible: false,
          cometPathsVisible: true,
          cometTailsVisible: true,
          tailActive: true,
        }),
      ).toBe(false);
    }
  });

  it("keeps path and tail switches independent under the master toggle", () => {
    expect(
      shouldShowCometVisual({
        kind: "path",
        cometsVisible: true,
        cometPathsVisible: false,
      }),
    ).toBe(false);
    expect(
      shouldShowCometVisual({
        kind: "tail",
        cometsVisible: true,
        cometTailsVisible: false,
        tailActive: true,
      }),
    ).toBe(false);
    expect(
      shouldShowCometVisual({
        kind: "tail",
        cometsVisible: true,
        cometTailsVisible: true,
        tailActive: false,
      }),
    ).toBe(false);
  });
});
