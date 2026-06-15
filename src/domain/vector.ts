export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const ZERO_VECTOR: Vector3 = Object.freeze({ x: 0, y: 0, z: 0 });

export function vector(x = 0, y = 0, z = 0): Vector3 {
  return { x, y, z };
}

export function add(a: Vector3, b: Vector3): Vector3 {
  return vector(a.x + b.x, a.y + b.y, a.z + b.z);
}

export function subtract(a: Vector3, b: Vector3): Vector3 {
  return vector(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function scale(value: Vector3, factor: number): Vector3 {
  return vector(value.x * factor, value.y * factor, value.z * factor);
}

export function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vector3, b: Vector3): Vector3 {
  return vector(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

export function magnitudeSquared(value: Vector3): number {
  return dot(value, value);
}

export function magnitude(value: Vector3): number {
  return Math.sqrt(magnitudeSquared(value));
}

export function isFiniteVector(value: Vector3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}
