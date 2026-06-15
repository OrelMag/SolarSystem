import { describe, expect, it } from "vitest";
import { vector } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";
import { scaleDistanceForDisplay } from "./distanceScale";

describe("scaleDistanceForDisplay", () => {
  it("leaves physical values unchanged at 1x", () => {
    const position = vector(ASTRONOMICAL_UNIT_M, 2, 3);
    expect(
      scaleDistanceForDisplay(position, { innerScale: 1, transitionRadiusAu: 8 }),
    ).toEqual(position);
  });

  it("expands the inner system while anchoring outer distances", () => {
    const inner = scaleDistanceForDisplay(vector(ASTRONOMICAL_UNIT_M, 0, 0), {
      innerScale: 6,
      transitionRadiusAu: 8,
    });
    const outer = scaleDistanceForDisplay(vector(10 * ASTRONOMICAL_UNIT_M, 0, 0), {
      innerScale: 6,
      transitionRadiusAu: 8,
    });
    expect(inner.x).toBeGreaterThan(4 * ASTRONOMICAL_UNIT_M);
    expect(outer.x).toBe(10 * ASTRONOMICAL_UNIT_M);
  });

  it("rejects invalid display scale configuration", () => {
    expect(() =>
      scaleDistanceForDisplay(vector(1, 0, 0), {
        innerScale: 0,
        transitionRadiusAu: 8,
      }),
    ).toThrow(/innerScale/);
  });
});
