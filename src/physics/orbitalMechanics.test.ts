import { describe, expect, it } from "vitest";
import { magnitude, subtract, vector } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M, GRAVITATIONAL_CONSTANT } from "./constants";
import {
  J2000_JULIAN_DAY,
  makeElementsFromDegrees,
  propagateEllipticOrbit,
  sampleOrbitPath,
  stateToOsculatingElements,
} from "./orbitalMechanics";

const SUN_MASS_KG = 1.98847e30;

describe("orbital mechanics", () => {
  it("round-trips an inclined elliptical state through osculating elements", () => {
    const elements = makeElementsFromDegrees({
      semiMajorAxisAu: 2.4,
      eccentricity: 0.31,
      inclinationDeg: 17,
      longitudeAscendingNodeDeg: 42,
      argumentPeriapsisDeg: 73,
      meanAnomalyDeg: 118,
      epochJulianDay: J2000_JULIAN_DAY,
    });
    const original = propagateEllipticOrbit(elements, J2000_JULIAN_DAY, SUN_MASS_KG);
    const recovered = stateToOsculatingElements(
      original.positionM,
      original.velocityMps,
      SUN_MASS_KG,
      J2000_JULIAN_DAY,
    );
    const roundTrip = propagateEllipticOrbit(recovered, J2000_JULIAN_DAY, SUN_MASS_KG);

    expect(magnitude(subtract(roundTrip.positionM, original.positionM))).toBeLessThan(2);
    expect(magnitude(subtract(roundTrip.velocityMps, original.velocityMps))).toBeLessThan(1e-6);
    expect(recovered.eccentricity).toBeCloseTo(elements.eccentricity, 10);
  });

  it("recovers a hyperbolic orbit from a periapsis state", () => {
    const eccentricity = 1.4;
    const periapsisM = 0.6 * ASTRONOMICAL_UNIT_M;
    const mu = GRAVITATIONAL_CONSTANT * SUN_MASS_KG;
    const periapsisSpeed = Math.sqrt((mu * (1 + eccentricity)) / periapsisM);
    const recovered = stateToOsculatingElements(
      vector(periapsisM, 0, 0),
      vector(0, periapsisSpeed, 0),
      SUN_MASS_KG,
      J2000_JULIAN_DAY,
    );

    expect(recovered.eccentricity).toBeCloseTo(eccentricity, 10);
    expect(recovered.semiMajorAxisM).toBeLessThan(0);
    expect(sampleOrbitPath(recovered, 32)).toHaveLength(33);
  });

  it("samples a closed ellipse that passes through its starting point", () => {
    const elements = makeElementsFromDegrees({
      semiMajorAxisAu: 1,
      eccentricity: 0.1,
      inclinationDeg: 0,
      longitudeAscendingNodeDeg: 0,
      argumentPeriapsisDeg: 20,
      meanAnomalyDeg: 0,
      epochJulianDay: J2000_JULIAN_DAY,
    });
    const path = sampleOrbitPath(elements, 64);
    expect(magnitude(subtract(path[0]!, path[path.length - 1]!))).toBeLessThan(0.01);
  });
});
