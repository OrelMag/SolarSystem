export interface SelectedBodyRefreshSnapshot {
  readonly bodyId: string;
  readonly elapsedSeconds: number;
  readonly refreshedAtMs: number;
}

export function shouldRefreshSelectedBodyDetail(input: {
  readonly force: boolean;
  readonly bodyId: string;
  readonly elapsedSeconds: number;
  readonly nowMs: number;
  readonly minimumIntervalMs: number;
  readonly previous?: SelectedBodyRefreshSnapshot;
}): boolean {
  if (input.force || !input.previous) return true;
  if (input.previous.bodyId !== input.bodyId) return true;
  if (input.previous.elapsedSeconds !== input.elapsedSeconds) return true;
  return input.nowMs - input.previous.refreshedAtMs >= input.minimumIntervalMs;
}
