import type { HierarchicalBodyState } from "../domain/orbits";
import type { MutableBodyState } from "../domain/types";
import { vector, type Vector3 } from "../domain/vector";

export type ViewFrame = "barycentric" | "sun-centered" | "selected-centered";

export function findPrimaryBody(
  bodies: readonly Readonly<MutableBodyState>[],
): Readonly<MutableBodyState> | undefined {
  return (
    bodies.find((body) => body.id === "sun") ??
    bodies.find((body) => body.category === "star") ??
    bodies[0]
  );
}

export function resolveViewFrameOrigin(input: {
  readonly frame: ViewFrame;
  readonly selectedBodyId: string;
  readonly originBodyId?: string;
  readonly bodies: readonly Readonly<MutableBodyState>[];
  readonly orbitalStates: readonly HierarchicalBodyState[];
}): Vector3 {
  if (input.frame === "barycentric") return vector();
  if (input.frame === "sun-centered") {
    return findPrimaryBody(input.bodies)?.positionM ?? vector();
  }
  const targetId =
    input.originBodyId ?? input.selectedBodyId;
  const massive = input.bodies.find((body) => body.id === targetId);
  if (massive) return massive.positionM;
  const orbital = input.orbitalStates.find((state) => state.body.id === targetId);
  return orbital?.positionM ?? vector();
}
