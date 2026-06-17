import { MASSIVE_BODY_FACTS } from "../data/bodyFacts";
import type { HierarchicalBodyState } from "../domain/orbits";
import type { MutableBodyState } from "../domain/types";
import { magnitude, subtract, type Vector3 } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M, GRAVITATIONAL_CONSTANT } from "../physics/constants";
import {
  formatAccelerationMps2,
  formatDistanceM,
  formatMass,
  formatSpeedMps,
  formatVector,
} from "./format";

export interface SelectedBodyDetail {
  readonly title: string;
  readonly rows: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly note: string;
}

export function buildSelectedBodyDetail(input: {
  readonly id: string;
  readonly massiveBodies: readonly Readonly<MutableBodyState>[];
  readonly orbitalStates: readonly HierarchicalBodyState[];
  readonly namesById: ReadonlyMap<string, string>;
  readonly accelerationsById: ReadonlyMap<string, Vector3>;
}): SelectedBodyDetail | undefined {
  const massive = input.massiveBodies.find((body) => body.id === input.id);
  if (massive) {
    return buildMassiveDetail(massive, input.massiveBodies, input.accelerationsById);
  }
  const orbital = input.orbitalStates.find((state) => state.body.id === input.id);
  if (!orbital) return undefined;
  return buildMasslessDetail(orbital, input.namesById);
}

function buildMassiveDetail(
  body: Readonly<MutableBodyState>,
  bodies: readonly Readonly<MutableBodyState>[],
  accelerationsById: ReadonlyMap<string, Vector3>,
): SelectedBodyDetail {
  const sun = bodies.find((candidate) => candidate.id === "sun");
  const facts = MASSIVE_BODY_FACTS[body.id];
  const acceleration = accelerationsById.get(body.id) ?? { x: 0, y: 0, z: 0 };
  const rows = [
    { label: "Category", value: body.category },
    { label: "Mass", value: formatMass(body.massKg) },
    { label: "Radius", value: formatDistanceM(body.radiusM) },
    { label: "Parent", value: body.id === "sun" ? "None" : "Sun" },
    {
      label: body.id === "sun" ? "Barycenter offset" : "Sun distance",
      value:
        sun && body.id !== "sun"
          ? formatDistanceM(magnitude(subtract(body.positionM, sun.positionM)))
          : formatDistanceM(magnitude(body.positionM)),
    },
    { label: "Speed", value: formatSpeedMps(magnitude(body.velocityMps)) },
    { label: "Acceleration", value: formatAccelerationMps2(magnitude(acceleration)) },
    { label: "Position", value: formatVector(body.positionM, "m") },
    { label: "Velocity", value: formatVector(body.velocityMps, "m/s") },
    {
      label: "Surface gravity",
      value: facts?.surfaceGravityMps2
        ? formatAccelerationMps2(facts.surfaceGravityMps2)
        : "Unknown",
    },
    { label: "Discovery", value: facts?.discovery ?? "Unknown" },
  ];
  return {
    title: body.name,
    rows,
    note: facts?.significance ?? "No additional fact metadata is available.",
  };
}

function buildMasslessDetail(
  state: HierarchicalBodyState,
  namesById: ReadonlyMap<string, string>,
): SelectedBodyDetail {
  const body = state.body;
  const gravity =
    body.facts.surfaceGravityMps2 ??
    (GRAVITATIONAL_CONSTANT * body.massKg) / body.radiusM ** 2;
  return {
    title: body.name,
    rows: [
      { label: "Category", value: body.category },
      { label: "Physics role", value: "Display-only massless body" },
      { label: "Catalog mass", value: formatMass(body.massKg) },
      { label: "Radius", value: formatDistanceM(body.radiusM) },
      { label: "Parent", value: namesById.get(body.parentId) ?? body.parentId },
      {
        label: body.category === "moon" ? "Parent distance" : "Sun distance",
        value:
          body.category === "moon"
            ? formatDistanceM(magnitude(state.relativePositionM))
            : `${(magnitude(state.positionM) / ASTRONOMICAL_UNIT_M).toFixed(4)} AU`,
      },
      { label: "Relative speed", value: formatSpeedMps(magnitude(state.relativeVelocityMps)) },
      { label: "Position", value: formatVector(state.positionM, "m") },
      { label: "Velocity", value: formatVector(state.velocityMps, "m/s") },
      { label: "Surface gravity", value: formatAccelerationMps2(gravity) },
      { label: "Discovery", value: body.facts.discovery },
    ],
    note: `${body.facts.significance} This object is propagated for exploration and does not alter N-body conservation diagnostics.`,
  };
}
