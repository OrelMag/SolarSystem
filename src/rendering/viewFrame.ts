import type { HierarchicalBodyState } from "../domain/orbits";
import type { MutableBodyState } from "../domain/types";
import { vector, type Vector3 } from "../domain/vector";

export type ViewFrame = "barycentric" | "sun-centered" | "selected-centered";

export function resolveViewFrameOrigin(input: {
  readonly frame: ViewFrame;
  readonly selectedBodyId: string;
  readonly bodies: readonly Readonly<MutableBodyState>[];
  readonly orbitalStates: readonly HierarchicalBodyState[];
}): Vector3 {
  if (input.frame === "barycentric") return vector();
  const targetId = input.frame === "sun-centered" ? "sun" : input.selectedBodyId;
  const massive = input.bodies.find((body) => body.id === targetId);
  if (massive) return massive.positionM;
  const orbital = input.orbitalStates.find((state) => state.body.id === targetId);
  return orbital?.positionM ?? vector();
}
