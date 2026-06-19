import { describe, expect, it } from "vitest";
import { formatDriftPartsPerMillion } from "./diagnosticsPanel";

describe("formatDriftPartsPerMillion", () => {
  it("formats drift as ppm with stable precision", () => {
    expect(formatDriftPartsPerMillion(0.0000012345)).toBe("1.234 ppm");
  });
});
