import { describe, expect, it } from "vitest";
import type { HierarchicalBodyState } from "../domain/orbits";
import type { MutableBodyState } from "../domain/types";
import { vector } from "../domain/vector";
import type { SpacecraftLaunch } from "../physics/launch";
import {
  ACTIVE_SPACECRAFT_ID,
  SPACECRAFT_MASS_KG,
  SPACECRAFT_RADIUS_M,
} from "../physics/launch";
import {
  createLaunchMissionState,
  createLaunchTargetOptions,
  findLaunchTargetState,
  updateLaunchMissionState,
} from "./launchMission";

function body(input: {
  readonly id: string;
  readonly name?: string;
  readonly category: MutableBodyState["category"];
  readonly parentId?: string;
  readonly x: number;
  readonly radiusM?: number;
}): MutableBodyState {
  return {
    id: input.id,
    name: input.name ?? input.id,
    category: input.category,
    parentId: input.parentId,
    massKg: input.category === "spacecraft" ? SPACECRAFT_MASS_KG : 1e20,
    radiusM: input.radiusM ?? (input.category === "spacecraft" ? SPACECRAFT_RADIUS_M : 1_000),
    positionM: vector(input.x, 0, 0),
    velocityMps: vector(),
    visual: { color: 0xffffff },
  };
}

describe("launch mission helpers", () => {
  it("lists planets, dwarf planets, and moons but excludes Earth and spacecraft", () => {
    const bodies = [
      body({ id: "sun", category: "star", x: 0 }),
      body({ id: "earth", name: "Earth", category: "planet", x: 1 }),
      body({ id: "mars", name: "Mars", category: "planet", x: 2 }),
      body({ id: ACTIVE_SPACECRAFT_ID, category: "spacecraft", x: 3 }),
      body({ id: "moon", name: "Moon", category: "moon", parentId: "earth", x: 4 }),
    ];
    const options = createLaunchTargetOptions({
      bodies,
      orbitalStates: [],
      namesById: new Map([
        ["sun", "Sun"],
        ["earth", "Earth"],
      ]),
    });

    expect(options.map((option) => option.id)).toEqual(["mars", "moon"]);
    expect(options[1]?.parentName).toBe("Earth");
  });

  it("can resolve display-only orbital target state", () => {
    const orbitalStates: HierarchicalBodyState[] = [
      {
        body: {
          id: "charon",
          name: "Charon",
          parentId: "pluto",
          category: "moon",
          massKg: 1.6e21,
          radiusM: 606_000,
          visual: { color: 0xffffff },
          elements: {
            semiMajorAxisM: 1,
            eccentricity: 0,
            inclinationRad: 0,
            longitudeAscendingNodeRad: 0,
            argumentPeriapsisRad: 0,
            meanAnomalyAtEpochRad: 0,
            epochJulianDay: 0,
          },
          source: {
            name: "test",
            url: "test",
            solutionEpochJulianDay: 0,
            referenceFrame: "test",
          },
          facts: { discovery: "test", significance: "test" },
        },
        positionM: vector(10, 0, 0),
        velocityMps: vector(0, 1, 0),
        parentPositionM: vector(),
        parentVelocityMps: vector(),
        relativePositionM: vector(10, 0, 0),
        relativeVelocityMps: vector(0, 1, 0),
      },
    ];

    expect(
      findLaunchTargetState({ id: "charon", bodies: [], orbitalStates })?.positionM.x,
    ).toBe(10);
  });

  it("tracks current distance and closest approach", () => {
    const launch: SpacecraftLaunch = {
      spacecraft: body({ id: ACTIVE_SPACECRAFT_ID, category: "spacecraft", x: 0 }),
      targetId: "mars",
      targetName: "Mars",
      transferKind: "interplanetary",
      estimatedTransferSeconds: 100,
      launchDistanceM: 1,
      targetDistanceAtLaunchM: 100_000_001,
      injectionSpeedMps: 10,
    };
    const mission = createLaunchMissionState({
      launch,
      target: { radiusM: 1 },
      elapsedSeconds: 0,
    });
    const closer = updateLaunchMissionState({
      mission,
      bodies: [
        body({ id: ACTIVE_SPACECRAFT_ID, category: "spacecraft", x: 70_000_000 }),
        body({ id: "mars", category: "planet", x: 100_000_000, radiusM: 1 }),
      ],
      orbitalStates: [],
      elapsedSeconds: 50,
    });
    const farther = updateLaunchMissionState({
      mission: closer,
      bodies: [
        body({ id: ACTIVE_SPACECRAFT_ID, category: "spacecraft", x: 150_000_000 }),
        body({ id: "mars", category: "planet", x: 100_000_000, radiusM: 1 }),
      ],
      orbitalStates: [],
      elapsedSeconds: 250,
    });

    expect(closer.currentDistanceM).toBe(30_000_000);
    expect(closer.closestApproachM).toBe(30_000_000);
    expect(closer.guidanceMode).toBe("guided");
    expect(farther.closestApproachM).toBe(30_000_000);
    expect(farther.status).toBe("missed");
  });
});
