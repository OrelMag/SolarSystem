import { describe, expect, it } from "vitest";
import { shouldCollapseSectionByDefault } from "./collapsibleSections";

describe("shouldCollapseSectionByDefault", () => {
  it("collapses heavier sections on narrow viewports only", () => {
    expect(
      shouldCollapseSectionByDefault({ title: "Telemetry", narrowViewport: true }),
    ).toBe(true);
    expect(
      shouldCollapseSectionByDefault({ title: "Telemetry", narrowViewport: false }),
    ).toBe(false);
    expect(
      shouldCollapseSectionByDefault({ title: "Simulation", narrowViewport: true }),
    ).toBe(false);
  });
});
