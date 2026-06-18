import type { HierarchicalBodyState, HierarchicalOrbitalBody } from "../domain/orbits";
import type { CollisionPolicy } from "../physics/collisionPolicy";
import { DAY_SECONDS } from "../physics/constants";
import {
  propagateHierarchicalBodies,
  validateOrbitalHierarchy,
} from "../physics/hierarchicalOrbits";
import { NBodySimulation } from "../physics/simulation";
import type { ScenarioDefinition } from "./scenarios";

export function createScenarioSimulation(
  scenario: ScenarioDefinition,
  collisionPolicy: CollisionPolicy,
  fixedTimestepSeconds: number,
): NBodySimulation {
  const bodies = scenario.createBodies();
  validateOrbitalHierarchy(
    scenario.displayOnlyOrbitalBodies,
    bodies.map((body) => body.id),
  );
  return new NBodySimulation(bodies, {
    fixedTimestepSeconds,
    collisionPolicy,
  });
}

export function calculateScenarioOrbitalStates(
  orbitalDefinitions: readonly HierarchicalOrbitalBody[],
  simulation: NBodySimulation,
): HierarchicalBodyState[] {
  return propagateHierarchicalBodies(
    orbitalDefinitions,
    simulation.bodies,
    2_451_545 + simulation.elapsedSeconds / DAY_SECONDS,
  );
}
