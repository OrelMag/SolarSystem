import type { MutableBodyState } from "../domain/types";
import { add, magnitude, scale, vector, type Vector3 } from "../domain/vector";
import type { ConservedQuantities } from "../physics/diagnostics";

export interface DiagnosticsSample {
  readonly elapsedSeconds: number;
  readonly energyDrift: number;
  readonly angularMomentumDrift: number;
}

export interface DiagnosticsStatus {
  readonly samples: readonly DiagnosticsSample[];
  readonly warning: boolean;
  readonly centerOfMassM: Vector3;
  readonly linearMomentumMagnitude: number;
  readonly angularMomentumMagnitude: number;
}

const MAX_SAMPLES = 96;

export class DiagnosticsHistory {
  private readonly samples: DiagnosticsSample[] = [];

  add(sample: DiagnosticsSample): void {
    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  reset(): void {
    this.samples.length = 0;
  }

  status(input: {
    readonly bodies: readonly Readonly<MutableBodyState>[];
    readonly current: ConservedQuantities;
    readonly energyWarningDrift: number;
    readonly angularMomentumWarningDrift: number;
  }): DiagnosticsStatus {
    const latest = this.samples.at(-1);
    return {
      samples: [...this.samples],
      warning:
        (latest?.energyDrift ?? 0) > input.energyWarningDrift ||
        (latest?.angularMomentumDrift ?? 0) > input.angularMomentumWarningDrift,
      centerOfMassM: calculateCenterOfMass(input.bodies),
      linearMomentumMagnitude: magnitude(input.current.linearMomentumKgMps),
      angularMomentumMagnitude: magnitude(input.current.angularMomentumKgM2ps),
    };
  }
}

export function calculateCenterOfMass(
  bodies: readonly Readonly<MutableBodyState>[],
): Vector3 {
  let totalMass = 0;
  let weighted = vector();
  for (const body of bodies) {
    totalMass += body.massKg;
    weighted = add(weighted, scale(body.positionM, body.massKg));
  }
  return totalMass > 0 ? scale(weighted, 1 / totalMass) : vector();
}

export function sparkline(samples: readonly DiagnosticsSample[], key: "energyDrift" | "angularMomentumDrift"): string {
  if (samples.length === 0) return "";
  const marks = "▁▂▃▄▅▆▇█";
  const values = samples.map((sample) => sample[key]);
  const max = Math.max(...values, 1e-18);
  return values
    .map((value) => marks[Math.min(marks.length - 1, Math.floor((value / max) * (marks.length - 1)))])
    .join("");
}
