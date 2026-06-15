import type { MutableBodyState } from "../domain/types";
import { add, cross, magnitude, scale, vector, type Vector3 } from "../domain/vector";
import { GRAVITATIONAL_CONSTANT } from "./constants";

export interface ConservedQuantities {
  readonly energyJ: number;
  readonly linearMomentumKgMps: Vector3;
  readonly angularMomentumKgM2ps: Vector3;
}

export function calculateConservedQuantities(
  bodies: readonly Readonly<MutableBodyState>[],
): ConservedQuantities {
  let kineticEnergy = 0;
  let potentialEnergy = 0;
  let linearMomentum = vector();
  let angularMomentum = vector();

  for (let index = 0; index < bodies.length; index += 1) {
    const body = bodies[index];
    if (!body) continue;
    const speedSquared =
      body.velocityMps.x ** 2 + body.velocityMps.y ** 2 + body.velocityMps.z ** 2;
    kineticEnergy += 0.5 * body.massKg * speedSquared;
    const momentum = scale(body.velocityMps, body.massKg);
    linearMomentum = add(linearMomentum, momentum);
    angularMomentum = add(angularMomentum, cross(body.positionM, momentum));

    for (let otherIndex = index + 1; otherIndex < bodies.length; otherIndex += 1) {
      const other = bodies[otherIndex];
      if (!other) continue;
      const distance = magnitude({
        x: other.positionM.x - body.positionM.x,
        y: other.positionM.y - body.positionM.y,
        z: other.positionM.z - body.positionM.z,
      });
      potentialEnergy -= (GRAVITATIONAL_CONSTANT * body.massKg * other.massKg) / distance;
    }
  }

  return {
    energyJ: kineticEnergy + potentialEnergy,
    linearMomentumKgMps: linearMomentum,
    angularMomentumKgM2ps: angularMomentum,
  };
}

export function relativeDrift(current: number, initial: number): number {
  if (initial === 0) return Math.abs(current);
  return Math.abs((current - initial) / initial);
}
