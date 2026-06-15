import type {
  HierarchicalBodyState,
  HierarchicalOrbitalBody,
  OrbitalState,
} from "../domain/orbits";
import type { MutableBodyState } from "../domain/types";
import { add } from "../domain/vector";
import { propagateEllipticOrbit } from "./orbitalMechanics";

interface ParentState extends OrbitalState {
  readonly massKg: number;
}

export function propagateHierarchicalBodies(
  definitions: readonly HierarchicalOrbitalBody[],
  massiveBodies: readonly Readonly<MutableBodyState>[],
  julianDay: number,
): HierarchicalBodyState[] {
  const definitionsById = new Map(definitions.map((body) => [body.id, body]));
  const massiveById = new Map(
    massiveBodies.map((body) => [
      body.id,
      {
        positionM: body.positionM,
        velocityMps: body.velocityMps,
        massKg: body.massKg,
      } satisfies ParentState,
    ]),
  );
  const resolved = new Map<string, HierarchicalBodyState>();
  const resolving = new Set<string>();

  const resolve = (definition: HierarchicalOrbitalBody): HierarchicalBodyState => {
    const existing = resolved.get(definition.id);
    if (existing) return existing;
    if (resolving.has(definition.id)) {
      throw new Error(`Orbital hierarchy contains a cycle at "${definition.id}".`);
    }
    resolving.add(definition.id);

    const massiveParent = massiveById.get(definition.parentId);
    const orbitalParent = definitionsById.get(definition.parentId);
    const parentState = massiveParent ?? (orbitalParent ? resolve(orbitalParent) : undefined);
    if (!parentState) {
      throw new Error(
        `Orbital body "${definition.id}" references missing parent "${definition.parentId}".`,
      );
    }
    const parentMassKg =
      "body" in parentState ? parentState.body.massKg : parentState.massKg;
    const relative = propagateEllipticOrbit(
      definition.elements,
      julianDay,
      parentMassKg + definition.massKg,
    );
    const state: HierarchicalBodyState = {
      body: definition,
      positionM: add(parentState.positionM, relative.positionM),
      velocityMps: add(parentState.velocityMps, relative.velocityMps),
      parentPositionM: parentState.positionM,
      parentVelocityMps: parentState.velocityMps,
      relativePositionM: relative.positionM,
      relativeVelocityMps: relative.velocityMps,
    };
    resolving.delete(definition.id);
    resolved.set(definition.id, state);
    return state;
  };

  return definitions.map(resolve);
}

export function validateOrbitalHierarchy(
  definitions: readonly HierarchicalOrbitalBody[],
  massiveBodyIds: readonly string[],
): void {
  const ids = new Set(massiveBodyIds);
  for (const definition of definitions) {
    if (ids.has(definition.id)) {
      throw new Error(`Duplicate body identifier "${definition.id}".`);
    }
    if (!(definition.massKg > 0) || !(definition.radiusM > 0)) {
      throw new Error(`Orbital body "${definition.id}" requires positive mass and radius.`);
    }
    if (!definition.source.name || !definition.source.url || !definition.facts.significance) {
      throw new Error(`Orbital body "${definition.id}" is missing source or educational metadata.`);
    }
    ids.add(definition.id);
  }
  propagateHierarchicalBodies(
    definitions,
    massiveBodyIds.map((id) => ({
      id,
      name: id,
      category: id === "sun" ? "star" : "planet",
      massKg: 1,
      radiusM: 1,
      positionM: { x: 0, y: 0, z: 0 },
      velocityMps: { x: 0, y: 0, z: 0 },
      visual: { color: 0 },
    })),
    2_451_545,
  );
}
