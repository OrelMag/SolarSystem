import type { CelestialBody, MutableBodyState, SimulationSnapshot } from "../domain/types";
import { add, isFiniteVector, scale, type Vector3 } from "../domain/vector";
import {
  DEFAULT_COLLISION_POLICY,
  validateCollisionPolicy,
  type CollisionPolicy,
} from "./collisionPolicy";
import { calculateAccelerations } from "./gravity";

export interface SimulationConfig {
  readonly fixedTimestepSeconds: number;
  readonly collisionPolicy?: CollisionPolicy;
}

function validateBodies(bodies: readonly CelestialBody[]): void {
  const identifiers = new Set<string>();
  for (const body of bodies) {
    validateBody(body);
    if (identifiers.has(body.id)) {
      throw new Error(`Body identifiers must be unique and non-empty: "${body.id}".`);
    }
    identifiers.add(body.id);
  }
}

function validateBody(body: CelestialBody): void {
  if (!body.id) {
    throw new Error(`Body identifiers must be unique and non-empty: "${body.id}".`);
  }
  if (!(body.massKg > 0) || !(body.radiusM > 0)) {
    throw new Error(`Body "${body.id}" must have positive mass and radius.`);
  }
  if (!isFiniteVector(body.positionM) || !isFiniteVector(body.velocityMps)) {
    throw new Error(`Body "${body.id}" has a non-finite state vector.`);
  }
}

function cloneBody(body: CelestialBody): MutableBodyState {
  return {
    ...body,
    positionM: { ...body.positionM },
    velocityMps: { ...body.velocityMps },
    visual: { ...body.visual },
  };
}

function cloneBodies(bodies: readonly CelestialBody[]): MutableBodyState[] {
  return bodies.map(cloneBody);
}

export class NBodySimulation {
  readonly fixedTimestepSeconds: number;
  private readonly collisionPolicy: CollisionPolicy;
  private readonly initialBodies: readonly CelestialBody[];
  private readonly runtimeBodyIds = new Set<string>();
  private state: MutableBodyState[];
  private elapsed = 0;

  constructor(bodies: readonly CelestialBody[], config: SimulationConfig) {
    validateBodies(bodies);
    if (!(config.fixedTimestepSeconds > 0) || !Number.isFinite(config.fixedTimestepSeconds)) {
      throw new Error("Fixed timestep must be finite and greater than zero.");
    }
    this.collisionPolicy = config.collisionPolicy ?? DEFAULT_COLLISION_POLICY;
    validateCollisionPolicy(this.collisionPolicy);
    this.initialBodies = bodies.map((body) => ({
      ...body,
      positionM: { ...body.positionM },
      velocityMps: { ...body.velocityMps },
      visual: { ...body.visual },
    }));
    this.state = cloneBodies(this.initialBodies);
    this.fixedTimestepSeconds = config.fixedTimestepSeconds;
  }

  static fromSnapshot(snapshot: SimulationSnapshot, config: SimulationConfig): NBodySimulation {
    const simulation = new NBodySimulation(snapshot.bodies, config);
    simulation.elapsed = snapshot.elapsedSeconds;
    return simulation;
  }

  get elapsedSeconds(): number {
    return this.elapsed;
  }

  get bodies(): readonly Readonly<MutableBodyState>[] {
    return this.state;
  }

  get snapshot(): SimulationSnapshot {
    return {
      elapsedSeconds: this.elapsed,
      bodies: this.state.map((body) => ({
        ...body,
        positionM: { ...body.positionM },
        velocityMps: { ...body.velocityMps },
      })),
    };
  }

  step(stepCount = 1): void {
    if (!Number.isInteger(stepCount) || stepCount < 0) {
      throw new Error("Step count must be a non-negative integer.");
    }

    for (let iteration = 0; iteration < stepCount; iteration += 1) {
      this.integrateOneStep();
    }
  }

  addRuntimeBody(body: CelestialBody): void {
    validateBody(body);
    if (this.state.some((candidate) => candidate.id === body.id)) {
      throw new Error(`Body identifiers must be unique and non-empty: "${body.id}".`);
    }
    this.state.push(cloneBody(body));
    this.runtimeBodyIds.add(body.id);
  }

  removeRuntimeBody(id: string): boolean {
    if (!this.runtimeBodyIds.has(id)) return false;
    const nextState = this.state.filter((body) => body.id !== id);
    const removed = nextState.length !== this.state.length;
    this.state = nextState;
    this.runtimeBodyIds.delete(id);
    return removed;
  }

  applyRuntimeBodyVelocityDelta(id: string, deltaVelocityMps: Vector3): void {
    if (!this.runtimeBodyIds.has(id)) {
      throw new Error(`Body "${id}" is not a runtime body.`);
    }
    if (!isFiniteVector(deltaVelocityMps)) {
      throw new Error(`Velocity delta for body "${id}" must be finite.`);
    }
    const body = this.state.find((candidate) => candidate.id === id);
    if (!body) throw new Error(`Runtime body "${id}" is missing from simulation state.`);
    body.velocityMps = add(body.velocityMps, deltaVelocityMps);
  }

  reset(): void {
    this.state = cloneBodies(this.initialBodies);
    this.runtimeBodyIds.clear();
    this.elapsed = 0;
  }

  private integrateOneStep(): void {
    const dt = this.fixedTimestepSeconds;
    const initialAcceleration = calculateAccelerations(this.state, this.collisionPolicy);

    for (let index = 0; index < this.state.length; index += 1) {
      const body = this.state[index];
      const acceleration = initialAcceleration[index];
      if (!body || !acceleration) continue;
      body.positionM = add(
        body.positionM,
        add(scale(body.velocityMps, dt), scale(acceleration, 0.5 * dt * dt)),
      );
    }

    const finalAcceleration = calculateAccelerations(this.state, this.collisionPolicy);
    for (let index = 0; index < this.state.length; index += 1) {
      const body = this.state[index];
      const before = initialAcceleration[index];
      const after = finalAcceleration[index];
      if (!body || !before || !after) continue;
      body.velocityMps = add(body.velocityMps, scale(add(before, after), 0.5 * dt));
      if (!isFiniteVector(body.positionM) || !isFiniteVector(body.velocityMps)) {
        throw new Error(`Body "${body.id}" became non-finite during integration.`);
      }
    }
    this.elapsed += dt;
  }
}
