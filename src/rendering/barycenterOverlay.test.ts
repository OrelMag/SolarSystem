import { describe, expect, it } from "vitest";
import { vector } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";
import { calculateBarycenterScenePosition } from "./barycenterOverlay";

describe("calculateBarycenterScenePosition", () => {
  it("maps barycenter SI coordinates through frame origin and distance scale", () => {
    const position = calculateBarycenterScenePosition({
      barycenterM: vector(2 * ASTRONOMICAL_UNIT_M, 0, 0),
      frameOriginM: vector(ASTRONOMICAL_UNIT_M, 0, 0),
      distanceScale: { scaleFactor: 3 },
    });

    expect(position).toEqual({ x: 3, y: 0, z: 0 });
  });
});
