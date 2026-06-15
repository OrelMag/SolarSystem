import { describe, expect, it } from "vitest";
import { vector } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";
import { scaleDistanceForDisplay } from "./distanceScale";

describe("scaleDistanceForDisplay", () => {
  it("leaves physical values unchanged at 1x", () => {
    const position = vector(ASTRONOMICAL_UNIT_M, 2, 3);
    expect(scaleDistanceForDisplay(position, { scaleFactor: 1 })).toEqual(position);
  });

  it("scales inner and outer system distances uniformly", () => {
    const inner = scaleDistanceForDisplay(
      vector(ASTRONOMICAL_UNIT_M, 0, 0),
      { scaleFactor: 6 },
    );
    const outer = scaleDistanceForDisplay(
      vector(30 * ASTRONOMICAL_UNIT_M, 0, 0),
      { scaleFactor: 6 },
    );
    expect(inner.x).toBe(6 * ASTRONOMICAL_UNIT_M);
    expect(outer.x).toBe(180 * ASTRONOMICAL_UNIT_M);
  });

  it("rejects invalid display scale configuration", () => {
    expect(() =>
      scaleDistanceForDisplay(vector(1, 0, 0), {
        scaleFactor: 0,
      }),
    ).toThrow(/scaleFactor/);
  });
});
