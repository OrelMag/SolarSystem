import { describe, expect, it } from "vitest";
import { resolveViewFrameOrigin } from "./viewFrame";

describe("resolveViewFrameOrigin", () => {
  const bodies = [
    {
      id: "sun",
      name: "Sun",
      category: "star" as const,
      massKg: 1,
      radiusM: 1,
      positionM: { x: 1, y: 2, z: 3 },
      velocityMps: { x: 0, y: 0, z: 0 },
      visual: { color: 0 },
    },
    {
      id: "earth",
      name: "Earth",
      category: "planet" as const,
      massKg: 1,
      radiusM: 1,
      positionM: { x: 4, y: 5, z: 6 },
      velocityMps: { x: 0, y: 0, z: 0 },
      visual: { color: 0 },
    },
  ];

  it("resolves barycentric and sun-centered origins without mutating bodies", () => {
    expect(
      resolveViewFrameOrigin({
        frame: "barycentric",
        selectedBodyId: "earth",
        bodies,
        orbitalStates: [],
      }),
    ).toEqual({ x: 0, y: 0, z: 0 });
    expect(
      resolveViewFrameOrigin({
        frame: "sun-centered",
        selectedBodyId: "earth",
        bodies,
        orbitalStates: [],
      }),
    ).toBe(bodies[0]?.positionM);
    expect(bodies[0]?.positionM).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("uses the primary star for sun-centered view when no body is named sun", () => {
    const validationBodies = [
      {
        id: "validation-primary",
        name: "Validation Primary",
        category: "star" as const,
        massKg: 1,
        radiusM: 1,
        positionM: { x: 7, y: 8, z: 9 },
        velocityMps: { x: 0, y: 0, z: 0 },
        visual: { color: 0 },
      },
      {
        id: "validation-orbiter",
        name: "Validation Orbiter",
        category: "planet" as const,
        massKg: 1,
        radiusM: 1,
        positionM: { x: 10, y: 11, z: 12 },
        velocityMps: { x: 0, y: 0, z: 0 },
        visual: { color: 0 },
      },
    ];

    expect(
      resolveViewFrameOrigin({
        frame: "sun-centered",
        selectedBodyId: "validation-orbiter",
        bodies: validationBodies,
        orbitalStates: [],
      }),
    ).toBe(validationBodies[0]?.positionM);
  });

  it("uses the selected body's physical position for selected-centered view", () => {
    expect(
      resolveViewFrameOrigin({
        frame: "selected-centered",
        selectedBodyId: "earth",
        bodies,
        orbitalStates: [],
      }),
    ).toBe(bodies[1]?.positionM);
  });

  it("can use a separate body as the selected-centered origin", () => {
    expect(
      resolveViewFrameOrigin({
        frame: "selected-centered",
        selectedBodyId: "earth",
        originBodyId: "sun",
        bodies,
        orbitalStates: [],
      }),
    ).toBe(bodies[0]?.positionM);
  });
});
