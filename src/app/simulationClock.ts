export interface PhysicsStepBudgetInput {
  readonly timeScaleSeconds: number;
  readonly fixedTimestepSeconds: number;
  readonly baseMaxStepsPerFrame: number;
  readonly targetFrameSeconds?: number;
  readonly fastForwardMaxStepsPerFrame?: number;
}

const DEFAULT_TARGET_FRAME_SECONDS = 1 / 60;
const DEFAULT_FAST_FORWARD_MAX_STEPS_PER_FRAME = 2_400;

export function calculatePhysicsStepBudget(input: PhysicsStepBudgetInput): number {
  if (!(input.baseMaxStepsPerFrame > 0) || !Number.isFinite(input.baseMaxStepsPerFrame)) {
    throw new Error("Base max steps per frame must be finite and greater than zero.");
  }
  if (!(input.fixedTimestepSeconds > 0) || !Number.isFinite(input.fixedTimestepSeconds)) {
    throw new Error("Fixed timestep must be finite and greater than zero.");
  }
  if (!(input.timeScaleSeconds > 0) || !Number.isFinite(input.timeScaleSeconds)) {
    return 0;
  }

  const targetFrameSeconds = finitePositiveOrDefault(
    input.targetFrameSeconds,
    DEFAULT_TARGET_FRAME_SECONDS,
  );
  const fastForwardMaxStepsPerFrame = Math.max(
    input.baseMaxStepsPerFrame,
    Math.floor(
      finitePositiveOrDefault(
        input.fastForwardMaxStepsPerFrame,
        DEFAULT_FAST_FORWARD_MAX_STEPS_PER_FRAME,
      ),
    ),
  );
  const targetStepsPerFrame = Math.ceil(
    (input.timeScaleSeconds * targetFrameSeconds) / input.fixedTimestepSeconds,
  );
  const bufferedStepsPerFrame = Math.ceil(targetStepsPerFrame * 1.25);
  return Math.max(
    1,
    Math.min(
      fastForwardMaxStepsPerFrame,
      Math.max(input.baseMaxStepsPerFrame, bufferedStepsPerFrame),
    ),
  );
}

function finitePositiveOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === "number" && value > 0 && Number.isFinite(value) ? value : fallback;
}
