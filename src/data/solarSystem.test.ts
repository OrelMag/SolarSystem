import { describe, expect, it } from "vitest";
import { magnitude } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";
import { createSolarSystem } from "./solarSystem";

describe("createSolarSystem", () => {
  it("creates the Sun and eight uniquely identified planets", () => {
    const bodies = createSolarSystem();
    expect(bodies).toHaveLength(9);
    expect(new Set(bodies.map((body) => body.id)).size).toBe(9);
    expect(bodies[0]?.id).toBe("sun");
    expect(bodies.filter((body) => body.category === "planet")).toHaveLength(8);
  });

  it("places Earth near one astronomical unit with a realistic speed", () => {
    const earth = createSolarSystem().find((body) => body.id === "earth");
    expect(earth).toBeDefined();
    const distanceAu = magnitude(earth!.positionM) / ASTRONOMICAL_UNIT_M;
    const speedKps = magnitude(earth!.velocityMps) / 1_000;
    expect(distanceAu).toBeGreaterThan(0.98);
    expect(distanceAu).toBeLessThan(1.02);
    expect(speedKps).toBeGreaterThan(29);
    expect(speedKps).toBeLessThan(31);
  });

  it("starts with near-zero barycentric linear momentum", () => {
    const bodies = createSolarSystem();
    const momentum = bodies.reduce(
      (total, body) => ({
        x: total.x + body.velocityMps.x * body.massKg,
        y: total.y + body.velocityMps.y * body.massKg,
        z: total.z + body.velocityMps.z * body.massKg,
      }),
      { x: 0, y: 0, z: 0 },
    );
    const scale = bodies.reduce(
      (total, body) => total + magnitude(body.velocityMps) * body.massKg,
      0,
    );
    expect(magnitude(momentum) / scale).toBeLessThan(1e-14);
  });
});
