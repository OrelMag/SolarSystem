import type { HierarchicalBodyState, OrbitalBodyCategory } from "../domain/orbits";
import type { BodyCategory, MutableBodyState } from "../domain/types";
import { magnitude, subtract } from "../domain/vector";
import type { LaunchTargetState, SpacecraftLaunch } from "../physics/launch";
import { ACTIVE_SPACECRAFT_ID } from "../physics/launch";
import type { SpacecraftGuidanceMode } from "../physics/guidance";

export type LaunchTargetCategory = Extract<
  BodyCategory | OrbitalBodyCategory,
  "planet" | "dwarf-planet" | "moon"
>;

export interface LaunchTargetOption {
  readonly id: string;
  readonly name: string;
  readonly category: LaunchTargetCategory;
  readonly parentName?: string;
}

export type LaunchMissionStatus = "ready" | "en-route" | "arrived" | "missed";

export interface LaunchMissionState {
  readonly targetId: string;
  readonly targetName: string;
  readonly launchedElapsedSeconds: number;
  readonly estimatedTransferSeconds: number;
  readonly arrivalThresholdM: number;
  readonly currentDistanceM: number;
  readonly closestApproachM: number;
  readonly guidanceMode: SpacecraftGuidanceMode;
  readonly status: LaunchMissionStatus;
}

const ARRIVAL_FLOOR_M = 25_000_000;

export function createLaunchTargetOptions(input: {
  readonly bodies: readonly Readonly<MutableBodyState>[];
  readonly orbitalStates: readonly HierarchicalBodyState[];
  readonly namesById: ReadonlyMap<string, string>;
}): LaunchTargetOption[] {
  const options = new Map<string, LaunchTargetOption>();
  for (const body of input.bodies) {
    if (!isLaunchTargetCategory(body.category) || body.id === "earth") continue;
    options.set(body.id, {
      id: body.id,
      name: body.name,
      category: body.category,
      parentName: input.namesById.get(body.parentId ?? "sun") ?? "Sun",
    });
  }
  for (const state of input.orbitalStates) {
    if (!isLaunchTargetCategory(state.body.category) || state.body.id === "earth") continue;
    if (options.has(state.body.id)) continue;
    options.set(state.body.id, {
      id: state.body.id,
      name: state.body.name,
      category: state.body.category,
      parentName: input.namesById.get(state.body.parentId),
    });
  }
  return [...options.values()].sort((a, b) => {
    const categoryRank = targetCategoryRank(a.category) - targetCategoryRank(b.category);
    return categoryRank || a.name.localeCompare(b.name);
  });
}

export function findLaunchTargetState(input: {
  readonly id: string;
  readonly bodies: readonly Readonly<MutableBodyState>[];
  readonly orbitalStates: readonly HierarchicalBodyState[];
}): LaunchTargetState | undefined {
  const body = input.bodies.find((candidate) => candidate.id === input.id);
  if (body && isLaunchTargetCategory(body.category)) {
    return {
      id: body.id,
      name: body.name,
      parentId: body.parentId,
      massKg: body.massKg,
      radiusM: body.radiusM,
      positionM: body.positionM,
      velocityMps: body.velocityMps,
    };
  }
  const orbital = input.orbitalStates.find((candidate) => candidate.body.id === input.id);
  if (orbital && isLaunchTargetCategory(orbital.body.category)) {
    return {
      id: orbital.body.id,
      name: orbital.body.name,
      parentId: orbital.body.parentId,
      massKg: orbital.body.massKg,
      radiusM: orbital.body.radiusM,
      positionM: orbital.positionM,
      velocityMps: orbital.velocityMps,
    };
  }
  return undefined;
}

export function createLaunchMissionState(input: {
  readonly launch: SpacecraftLaunch;
  readonly target: Pick<LaunchTargetState, "radiusM">;
  readonly elapsedSeconds: number;
}): LaunchMissionState {
  const currentDistanceM = Math.max(
    0,
    input.launch.targetDistanceAtLaunchM - input.launch.launchDistanceM,
  );
  const arrivalThresholdM = calculateArrivalThresholdM(input.target);
  return {
    targetId: input.launch.targetId,
    targetName: input.launch.targetName,
    launchedElapsedSeconds: input.elapsedSeconds,
    estimatedTransferSeconds: input.launch.estimatedTransferSeconds,
    arrivalThresholdM,
    currentDistanceM,
    closestApproachM: currentDistanceM,
    guidanceMode: "guided",
    status: "en-route",
  };
}

export function updateLaunchMissionState(input: {
  readonly mission: LaunchMissionState;
  readonly bodies: readonly Readonly<MutableBodyState>[];
  readonly orbitalStates: readonly HierarchicalBodyState[];
  readonly elapsedSeconds: number;
}): LaunchMissionState {
  const spacecraft = input.bodies.find((body) => body.id === ACTIVE_SPACECRAFT_ID);
  const target = findLaunchTargetState({
    id: input.mission.targetId,
    bodies: input.bodies,
    orbitalStates: input.orbitalStates,
  });
  if (!spacecraft || !target) return input.mission;
  const currentDistanceM = magnitude(subtract(spacecraft.positionM, target.positionM));
  const closestApproachM = Math.min(input.mission.closestApproachM, currentDistanceM);
  const elapsedMissionSeconds = input.elapsedSeconds - input.mission.launchedElapsedSeconds;
  const arrivalThresholdM = input.mission.arrivalThresholdM;
  const status =
    input.mission.status === "arrived" || currentDistanceM <= arrivalThresholdM
      ? "arrived"
      : elapsedMissionSeconds > input.mission.estimatedTransferSeconds * 2 &&
          currentDistanceM > closestApproachM * 1.25
        ? "missed"
        : "en-route";
  return {
    ...input.mission,
    guidanceMode: status === "arrived" ? "station-keeping" : "guided",
    currentDistanceM,
    closestApproachM,
    status,
  };
}

export function updateLaunchMissionGuidanceMode(
  mission: LaunchMissionState,
  guidanceMode: SpacecraftGuidanceMode,
): LaunchMissionState {
  return {
    ...mission,
    guidanceMode,
    status: guidanceMode === "station-keeping" ? "arrived" : mission.status,
  };
}

export function calculateArrivalThresholdM(target: Pick<LaunchTargetState, "radiusM">): number {
  return Math.max(target.radiusM, ARRIVAL_FLOOR_M);
}

function isLaunchTargetCategory(
  category: BodyCategory | OrbitalBodyCategory,
): category is LaunchTargetCategory {
  return category === "planet" || category === "dwarf-planet" || category === "moon";
}

function targetCategoryRank(category: LaunchTargetCategory): number {
  if (category === "planet") return 0;
  if (category === "dwarf-planet") return 1;
  return 2;
}
