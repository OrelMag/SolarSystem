import { describe, expect, it } from "vitest";
import { EXPLORATION_BODIES } from "../data/satellites";
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
    expect(detail?.note).toContain("life");
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
