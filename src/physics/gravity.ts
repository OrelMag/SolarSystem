import type { MutableBodyState } from "../domain/types";
import { vector, type Vector3 } from "../domain/vector";
import {
  DEFAULT_COLLISION_POLICY,
  SimulationCollisionError,
  validateCollisionPolicy,
  type CollisionPolicy,
} from "./collisionPolicy";
import { GRAVITATIONAL_CONSTANT } from "./constants";

export function calculateAccelerations(
  bodies: readonly Readonly<MutableBodyState>[],
  collisionPolicy: CollisionPolicy = DEFAULT_COLLISION_POLICY,
): Vector3[] {
  validateCollisionPolicy(collisionPolicy);

  const acceleration = bodies.map(() => ({ x: 0, y: 0, z: 0 }));
  const minimumDistanceSquared = collisionPolicy.minimumDistanceM ** 2;

  for (let first = 0; first < bodies.length; first += 1) {
    const bodyA = bodies[first];
    if (!bodyA) continue;

    for (let second = first + 1; second < bodies.length; second += 1) {
      const bodyB = bodies[second];
      if (!bodyB) continue;

      const dx = bodyB.positionM.x - bodyA.positionM.x;
      const dy = bodyB.positionM.y - bodyA.positionM.y;
      const dz = bodyB.positionM.z - bodyA.positionM.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      if (distanceSquared < minimumDistanceSquared) {
        throw new SimulationCollisionError({
          bodyAId: bodyA.id,
          bodyBId: bodyB.id,
          distanceM: Math.sqrt(distanceSquared),
          minimumDistanceM: collisionPolicy.minimumDistanceM,
        });
      }

      const inverseDistance = 1 / Math.sqrt(distanceSquared);
      const inverseDistanceCubed = inverseDistance / distanceSquared;
      const factorA = GRAVITATIONAL_CONSTANT * bodyB.massKg * inverseDistanceCubed;
      const factorB = GRAVITATIONAL_CONSTANT * bodyA.massKg * inverseDistanceCubed;
      const accelerationA = acceleration[first];
      const accelerationB = acceleration[second];
      if (!accelerationA || !accelerationB) continue;

      accelerationA.x += dx * factorA;
      accelerationA.y += dy * factorA;
      accelerationA.z += dz * factorA;
      accelerationB.x -= dx * factorB;
      accelerationB.y -= dy * factorB;
      accelerationB.z -= dz * factorB;
    }
  }

  return acceleration.map((value) => vector(value.x, value.y, value.z));
}
