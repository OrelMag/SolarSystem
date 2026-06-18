export interface PerformanceTelemetry {
  readonly physicsMs: number;
  readonly renderMs: number;
  readonly diagnosticsMs: number;
  readonly bodyCount: number;
  readonly visibleObjectCount: number;
}

export function formatMilliseconds(value: number): string {
  return `${Math.max(0, value).toFixed(2)} ms`;
}
