import { describe, expect, it } from "vitest";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";
import {
  J2000_JULIAN_DAY,
  propagateEllipticOrbit,
} from "../physics/orbitalMechanics";
import { createMinimumDistanceCollisionPolicy } from "../physics/collisionPolicy";
import { NBodySimulation } from "../physics/simulation";
import { COMETS } from "./comets";
import { createSolarSystem } from "./solarSystem";

describe("comet catalog", () => {
  it("contains the curated JPL objects with plausible perihelia and aphelia", () => {
    expect(COMETS.map((comet) => comet.id)).toEqual([
      "1p-halley",
      "c1995-o1-hale-bopp",
      "2p-encke",
      "67p-churyumov-gerasimenko",
    ]);
    for (const comet of COMETS) {
      const semiMajorAxisAu = comet.elements.semiMajorAxisM / ASTRONOMICAL_UNIT_M;
      const perihelionAu = semiMajorAxisAu * (1 - comet.elements.eccentricity);
      const aphelionAu = semiMajorAxisAu * (1 + comet.elements.eccentricity);
      expect(perihelionAu).toBeGreaterThan(0.3);
      expect(perihelionAu).toBeLessThan(1.3);
      expect(aphelionAu).toBeGreaterThan(perihelionAu);
      expect(comet.source.solutionEpochJulianDay).toBe(comet.elements.epochJulianDay);
    }
  });

  it("propagates finite states without affecting massive-body integration", () => {
    const bodies = createSolarSystem();
    const baseline = new NBodySimulation(bodies, {
      fixedTimestepSeconds: 10_800,
      collisionPolicy: createMinimumDistanceCollisionPolicy(1_000),
    });
    const comparison = new NBodySimulation(bodies, {
      fixedTimestepSeconds: 10_800,
      collisionPolicy: createMinimumDistanceCollisionPolicy(1_000),
    });
    const sunMassKg = bodies[0]!.massKg;
    for (let index = 0; index < 100; index += 1) {
      baseline.step();
      for (const comet of COMETS) {
        const state = propagateEllipticOrbit(
          comet.elements,
          J2000_JULIAN_DAY + baseline.elapsedSeconds / 86_400,
          sunMassKg,
        );
        expect(Number.isFinite(state.positionM.x)).toBe(true);
      }
      comparison.step();
    }
    expect(baseline.snapshot).toEqual(comparison.snapshot);
  });
});
