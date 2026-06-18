export interface ErrorOnCloseApproachPolicy {
  readonly kind: "error-on-close-approach";
  readonly minimumDistanceM: number;
}

export type CollisionPolicy = ErrorOnCloseApproachPolicy;

export class SimulationCollisionError extends Error {
  readonly bodyAId: string;
  readonly bodyBId: string;
  readonly distanceM: number;
  readonly minimumDistanceM: number;

  constructor(input: {
    readonly bodyAId: string;
    readonly bodyBId: string;
    readonly distanceM: number;
    readonly minimumDistanceM: number;
  }) {
    super(
      `Bodies "${input.bodyAId}" and "${input.bodyBId}" are ${input.distanceM.toExponential(3)} m apart, below the configured minimum ${input.minimumDistanceM.toExponential(3)} m.`,
    );
    this.name = "SimulationCollisionError";
    this.bodyAId = input.bodyAId;
    this.bodyBId = input.bodyBId;
    this.distanceM = input.distanceM;
    this.minimumDistanceM = input.minimumDistanceM;
  }
}

export const DEFAULT_COLLISION_POLICY: CollisionPolicy = {
  kind: "error-on-close-approach",
  minimumDistanceM: 1,
};

export function createMinimumDistanceCollisionPolicy(minimumDistanceM: number): CollisionPolicy {
  const policy: CollisionPolicy = {
    kind: "error-on-close-approach",
    minimumDistanceM,
  };
  validateCollisionPolicy(policy);
  return policy;
}

export function validateCollisionPolicy(policy: CollisionPolicy): void {
  if (policy.kind !== "error-on-close-approach") {
    const exhaustive: never = policy.kind;
    throw new Error(`Unsupported collision policy "${exhaustive}".`);
  }
  if (!(policy.minimumDistanceM > 0) || !Number.isFinite(policy.minimumDistanceM)) {
    throw new Error("Collision policy minimum distance must be finite and greater than zero.");
  }
}
