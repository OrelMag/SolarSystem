import { describe, expect, it } from "vitest";
import { launchStatusLabel } from "./launchPanel";

describe("launchStatusLabel", () => {
  it("formats launch status labels for compact panel display", () => {
    expect(launchStatusLabel("en-route")).toBe("EN ROUTE");
    expect(launchStatusLabel("arrived")).toBe("ARRIVED");
  });
});
