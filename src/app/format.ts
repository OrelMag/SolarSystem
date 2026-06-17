import { ASTRONOMICAL_UNIT_M, DAY_SECONDS } from "../physics/constants";
import type { Vector3 } from "../domain/vector";

export function formatMass(kg: number): string {
  return `${kg.toExponential(4)} kg`;
}

export function formatDistanceM(metres: number): string {
  const absolute = Math.abs(metres);
  if (absolute >= 0.05 * ASTRONOMICAL_UNIT_M) {
    return `${(metres / ASTRONOMICAL_UNIT_M).toFixed(4)} AU`;
  }
  return `${(metres / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

export function formatSpeedMps(mps: number): string {
  return `${(mps / 1_000).toFixed(3)} km/s`;
}

export function formatAccelerationMps2(value: number): string {
  if (value === 0) return "0 m/s^2";
  if (Math.abs(value) < 0.001) return `${value.toExponential(3)} m/s^2`;
  return `${value.toFixed(6)} m/s^2`;
}

export function formatElapsed(seconds: number): string {
  const days = seconds / DAY_SECONDS;
  if (days < 730) return `${days.toFixed(2)} days`;
  return `${(days / 365.25).toFixed(3)} years`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toLocaleString()} seconds`;
  if (seconds < 3_600) return `${(seconds / 60).toLocaleString()} minutes`;
  if (seconds < DAY_SECONDS) return `${(seconds / 3_600).toLocaleString()} hours`;
  return `${(seconds / DAY_SECONDS).toLocaleString()} days`;
}

export function formatVector(value: Vector3, unit: string, scale = 1): string {
  const x = value.x / scale;
  const y = value.y / scale;
  const z = value.z / scale;
  return `x ${x.toExponential(3)}, y ${y.toExponential(3)}, z ${z.toExponential(3)} ${unit}`;
}
