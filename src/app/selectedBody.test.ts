import { describe, expect, it } from "vitest";
import { EXPLORATION_BODIES } from "../data/satellites";
import { createPhysicalSolarSystem } from "../data/physicalSolarSystem";
import { createSolarSystem } from "../data/solarSystem";
import { propagateHierarchicalBodies } from "../physics/hierarchicalOrbits";
import { buildSelectedBodyDetail } from "./selectedBody";

describe("selected body details", () => {
  it("builds rich details for a massive body", () => {
    const bodies = createSolarSystem();
    const names = new Map(bodies.map((body) => [body.id, body.name] as const));
    const detail = buildSelectedBodyDetail({
      id: "earth",
      massiveBodies: bodies,
      orbitalStates: [],
      namesById: names,
      accelerationsById: new Map([["earth", { x: 0.1, y: 0, z: 0 }]]),
    });
    expect(detail?.title).toBe("Earth");
    expect(detail?.rows.map((row) => row.label)).toContain("Acceleration");
    expect(detail?.rows.map((row) => row.label)).toContain("Orbital period estimate");
    expect(detail?.rows.map((row) => row.label)).toContain("Periapsis estimate");
    expect(detail?.note).toContain("life");
  });

  it("treats a non-sun root star as parentless", () => {
    const bodies = [
      {
        id: "validation-primary",
        name: "Validation Primary",
        category: "star" as const,
        massKg: 1e26,
        radiusM: 1e6,
        positionM: { x: 0, y: 0, z: 0 },
        velocityMps: { x: 0, y: 0, z: 0 },
        visual: { color: 0xffffff },
      },
      {
        id: "validation-orbiter",
        name: "Validation Orbiter",
        category: "planet" as const,
        parentId: "validation-primary",
        massKg: 1e20,
        radiusM: 1e4,
        positionM: { x: 1e9, y: 0, z: 0 },
        velocityMps: { x: 0, y: 2_500, z: 0 },
        visual: { color: 0xffffff },
      },
    ];
    const names = new Map(bodies.map((body) => [body.id, body.name] as const));
    const detail = buildSelectedBodyDetail({
      id: "validation-primary",
      massiveBodies: bodies,
      orbitalStates: [],
      namesById: names,
      accelerationsById: new Map(),
    });

    expect(detail?.rows).toContainEqual({ label: "Parent", value: "None" });
    expect(detail?.rows.map((row) => row.label)).toContain("Barycenter offset");
  });

  it("labels physical moons as simulated bodies with parent-relative values", () => {
    const bodies = createPhysicalSolarSystem();
    const names = new Map(bodies.map((body) => [body.id, body.name] as const));
    const detail = buildSelectedBodyDetail({
      id: "moon",
      massiveBodies: bodies,
      orbitalStates: [],
      namesById: names,
      accelerationsById: new Map([["moon", { x: 0.002, y: 0, z: 0 }]]),
    });
    expect(detail?.title).toBe("Moon");
    expect(detail?.rows).toContainEqual({ label: "Parent", value: "Earth" });
    expect(detail?.rows.map((row) => row.label)).toContain("Parent-relative speed");
    expect(detail?.rows.some((row) => row.value === "Display-only massless body")).toBe(false);
  });

  it("describes launched spacecraft as active N-body participants", () => {
    const bodies = [
      ...createSolarSystem(),
      {
        id: "spacecraft-active",
        name: "Spacecraft",
        category: "spacecraft" as const,
        parentId: "earth",
        massKg: 10_000,
        radiusM: 10,
        positionM: { x: 1, y: 0, z: 0 },
        velocityMps: { x: 0, y: 1, z: 0 },
        visual: { color: 0x8ee8ff },
      },
    ];
    const names = new Map(bodies.map((body) => [body.id, body.name] as const));
    const detail = buildSelectedBodyDetail({
      id: "spacecraft-active",
      massiveBodies: bodies,
      orbitalStates: [],
      namesById: names,
      accelerationsById: new Map([["spacecraft-active", { x: 0.01, y: 0, z: 0 }]]),
    });

    expect(detail?.title).toBe("Spacecraft");
    expect(detail?.rows).toContainEqual({ label: "Category", value: "spacecraft" });
    expect(detail?.note).toContain("launched spacecraft");
  });

  it("labels hierarchical bodies as display-only", () => {
    const bodies = createSolarSystem();
    const states = propagateHierarchicalBodies(EXPLORATION_BODIES, bodies, 2_451_545);
    const names = new Map([
      ...bodies.map((body) => [body.id, body.name] as const),
      ...EXPLORATION_BODIES.map((body) => [body.id, body.name] as const),
    ]);
    const detail = buildSelectedBodyDetail({
      id: "moon",
      massiveBodies: bodies,
      orbitalStates: states,
      namesById: names,
      accelerationsById: new Map(),
    });
    expect(detail?.rows.some((row) => row.value === "Display-only massless body")).toBe(true);
    expect(detail?.note).toContain("does not alter N-body");
  });
});
