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

export interface MasslessOrbitalBody {
  readonly id: string;
  readonly name: string;
  readonly category: "comet";
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
}

export interface MasslessBodyState {
  readonly body: MasslessOrbitalBody;
  readonly positionM: Vector3;
  readonly velocityMps: Vector3;
}

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
