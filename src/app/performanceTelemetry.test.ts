import { describe, expect, it } from "vitest";
import { formatMilliseconds } from "./performanceTelemetry";

describe("formatMilliseconds", () => {
  it("formats non-negative millisecond values with stable precision", () => {
    expect(formatMilliseconds(1.234)).toBe("1.23 ms");
    expect(formatMilliseconds(-1)).toBe("0.00 ms");
  });
});
