import type { MutableBodyState } from "../domain/types";
import { vector, type Vector3 } from "../domain/vector";
import { GRAVITATIONAL_CONSTANT } from "./constants";

export function calculateAccelerations(
  bodies: readonly Readonly<MutableBodyState>[],
  minimumDistanceM = 1,
): Vector3[] {
  if (!(minimumDistanceM > 0) || !Number.isFinite(minimumDistanceM)) {
    throw new Error("Minimum interaction distance must be finite and greater than zero.");
  }

  const acceleration = bodies.map(() => ({ x: 0, y: 0, z: 0 }));
  const minimumDistanceSquared = minimumDistanceM ** 2;

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
        throw new Error(`Bodies "${bodyA.id}" and "${bodyB.id}" are too close to integrate.`);
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
