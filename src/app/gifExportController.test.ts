import { describe, expect, it } from "vitest";
import { formatGifExportProgress } from "./gifExportController";

describe("formatGifExportProgress", () => {
  it("uses one-based frame numbers", () => {
    expect(formatGifExportProgress(0, 24)).toBe("Encoding frame 1 of 24");
  });
});
