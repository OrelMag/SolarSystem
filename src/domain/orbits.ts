import type { Vector3 } from "./vector";

export interface KeplerianElements {
  readonly semiMajorAxisM: number;
  readonly eccentricity: number;
  readonly inclinationRad: number;
  readonly longitudeAscendingNodeRad: number;
  readonly argumentPeriapsisRad: number;
  readonly meanAnomalyAtEpochRad: number;
  readonly epochJulianDay: number;
}

export interface OrbitalState {
  readonly positionM: Vector3;
  readonly velocityMps: Vector3;
}

export type OrbitalBodyCategory = "comet" | "dwarf-planet" | "moon";

export interface EducationalFacts {
  readonly discovery: string;
  readonly significance: string;
  readonly surfaceGravityMps2?: number;
}

export interface HierarchicalOrbitalBody {
  readonly id: string;
  readonly name: string;
  readonly parentId: string;
  readonly category: OrbitalBodyCategory;
  readonly massKg: number;
  readonly radiusM: number;
  readonly visual: {
    readonly color: number;
  };
  readonly elements: KeplerianElements;
  readonly source: {
    readonly name: string;
    readonly url: string;
    readonly solutionEpochJulianDay: number;
    readonly referenceFrame: string;
  };
  readonly facts: EducationalFacts;
}

export type MasslessOrbitalBody = HierarchicalOrbitalBody;

export interface HierarchicalBodyState {
  readonly body: HierarchicalOrbitalBody;
  readonly positionM: Vector3;
  readonly velocityMps: Vector3;
  readonly parentPositionM: Vector3;
  readonly parentVelocityMps: Vector3;
  readonly relativePositionM: Vector3;
  readonly relativeVelocityMps: Vector3;
}

export type MasslessBodyState = HierarchicalBodyState;

export interface ParticleBeltDefinition {
  readonly id: "main-belt" | "kuiper-belt";
  readonly name: string;
  readonly count: number;
  readonly seed: number;
  readonly minimumSemiMajorAxisAu: number;
  readonly maximumSemiMajorAxisAu: number;
  readonly maximumEccentricity: number;
  readonly maximumInclinationDeg: number;
  readonly excludedSemiMajorAxisAu?: readonly {
    readonly center: number;
    readonly halfWidth: number;
  }[];
  readonly color: number;
  readonly opacity: number;
}

export interface OrbitalParticle {
  readonly elements: KeplerianElements;
}
