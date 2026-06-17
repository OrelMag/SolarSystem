import type { Vector3 } from "./vector";

export type BodyCategory = "star" | "planet" | "moon" | "dwarf-planet" | "minor-body";

export interface BodyVisual {
  readonly color: number;
  readonly emissive?: number;
}

export interface CelestialBody {
  readonly id: string;
  readonly name: string;
  readonly category: BodyCategory;
  readonly parentId?: string;
  readonly massKg: number;
  readonly radiusM: number;
  readonly positionM: Vector3;
  readonly velocityMps: Vector3;
  readonly visual: BodyVisual;
}

export interface MutableBodyState {
  readonly id: string;
  readonly name: string;
  readonly category: BodyCategory;
  readonly parentId?: string;
  readonly massKg: number;
  readonly radiusM: number;
  positionM: Vector3;
  velocityMps: Vector3;
  readonly visual: BodyVisual;
}

export interface SimulationSnapshot {
  readonly elapsedSeconds: number;
  readonly bodies: readonly Readonly<MutableBodyState>[];
}
