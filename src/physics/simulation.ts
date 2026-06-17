import type { CelestialBody, MutableBodyState, SimulationSnapshot } from "../domain/types";
import { add, isFiniteVector, scale } from "../domain/vector";
import { calculateAccelerations } from "./gravity";

export interface SimulationConfig {
  readonly fixedTimestepSeconds: number;
  readonly minimumDistanceM: number;
}

function validateBodies(bodies: readonly CelestialBody[]): void {
  const identifiers = new Set<string>();
  for (const body of bodies) {
    if (!body.id || identifiers.has(body.id)) {
      throw new Error(`Body identifiers must be unique and non-empty: "${body.id}".`);
    }
    if (!(body.massKg > 0) || !(body.radiusM > 0)) {
      throw new Error(`Body "${body.id}" must have positive mass and radius.`);
    }
    if (!isFiniteVector(body.positionM) || !isFiniteVector(body.velocityMps)) {
      throw new Error(`Body "${body.id}" has a non-finite state vector.`);
    }
    identifiers.add(body.id);
  }
}

function cloneBodies(bodies: readonly CelestialBody[]): MutableBodyState[] {
  return bodies.map((body) => ({
    ...body,
    positionM: { ...body.positionM },
    velocityMps: { ...body.velocityMps },
    visual: { ...body.visual },
  }));
}

export class NBodySimulation {
  readonly fixedTimestepSeconds: number;
  private readonly minimumDistanceM: number;
  private readonly initialBodies: readonly CelestialBody[];
  private state: MutableBodyState[];
  private elapsed = 0;

  constructor(bodies: readonly CelestialBody[], config: SimulationConfig) {
    validateBodies(bodies);
    if (!(config.fixedTimestepSeconds > 0) || !Number.isFinite(config.fixedTimestepSeconds)) {
      throw new Error("Fixed timestep must be finite and greater than zero.");
    }
    this.initialBodies = bodies.map((body) => ({
      ...body,
      positionM: { ...body.positionM },
      velocityMps: { ...body.velocityMps },
      visual: { ...body.visual },
    }));
    this.state = cloneBodies(this.initialBodies);
    this.fixedTimestepSeconds = config.fixedTimestepSeconds;
    this.minimumDistanceM = config.minimumDistanceM;
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

  reset(): void {
    this.state = cloneBodies(this.initialBodies);
    this.elapsed = 0;
  }

  private integrateOneStep(): void {
    const dt = this.fixedTimestepSeconds;
    const initialAcceleration = calculateAccelerations(this.state, this.minimumDistanceM);

    for (let index = 0; index < this.state.length; index += 1) {
      const body = this.state[index];
      const acceleration = initialAcceleration[index];
      if (!body || !acceleration) continue;
      body.positionM = add(
        body.positionM,
        add(scale(body.velocityMps, dt), scale(acceleration, 0.5 * dt * dt)),
      );
    }

    const finalAcceleration = calculateAccelerations(this.state, this.minimumDistanceM);
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
