import { DAY_SECONDS } from "../physics/constants";

const EARTH_ORBIT_SECONDS = 365.25 * DAY_SECONDS;
const MIN_OUTPUT_WIDTH_PX = 320;
const MIN_OUTPUT_HEIGHT_PX = 180;

export interface GifExportOptions {
  readonly frameCount: number;
  readonly framesPerSecond: number;
  readonly outputWidthPx: number;
  readonly outputHeightPx: number;
  readonly longExportStepThreshold: number;
  readonly simulatedDurationSeconds: number;
}

export interface GifExportEstimate {
  readonly selectedBodyId: string;
  readonly outputWidthPx: number;
  readonly outputHeightPx: number;
  readonly simulatedDurationSeconds: number;
  readonly frameCount: number;
  readonly framesPerSecond: number;
  readonly frameDelayMs: number;
  readonly physicsStepCount: number;
  readonly requiresConfirmation: boolean;
  readonly fileName: string;
}

export const DEFAULT_GIF_EXPORT_OPTIONS: GifExportOptions = Object.freeze({
  frameCount: 180,
  framesPerSecond: 15,
  outputWidthPx: 3440,
  outputHeightPx: 1440,
  longExportStepThreshold: 250_000,
  simulatedDurationSeconds: EARTH_ORBIT_SECONDS,
});

export function estimateCurrentViewGifExport(input: {
  readonly selectedBodyId: string;
  readonly scenarioId: string;
  readonly fixedTimestepSeconds: number;
  readonly options?: Partial<GifExportOptions>;
}): GifExportEstimate {
  const options = normalizeGifExportOptions(input.options);
  const fixedTimestepSeconds = finiteNonNegative(input.fixedTimestepSeconds);
  if (!(fixedTimestepSeconds > 0)) {
    throw new Error("GIF export requires a positive fixed physics timestep.");
  }

  const simulatedDurationSeconds = options.simulatedDurationSeconds;
  const physicsStepCount =
    simulatedDurationSeconds > 0
      ? Math.ceil(simulatedDurationSeconds / fixedTimestepSeconds)
      : 0;

  return {
    selectedBodyId: input.selectedBodyId,
    outputWidthPx: options.outputWidthPx,
    outputHeightPx: options.outputHeightPx,
    simulatedDurationSeconds,
    frameCount: options.frameCount,
    framesPerSecond: options.framesPerSecond,
    frameDelayMs: Math.round(1_000 / options.framesPerSecond),
    physicsStepCount,
    requiresConfirmation: physicsStepCount > options.longExportStepThreshold,
    fileName: `solar-system-${sanitizeFilePart(input.scenarioId)}-${sanitizeFilePart(input.selectedBodyId)}-current-view.gif`,
  };
}

export function normalizeGifExportOptions(options: Partial<GifExportOptions> = {}): GifExportOptions {
  const frameCount = Math.max(
    2,
    Math.floor(options.frameCount ?? DEFAULT_GIF_EXPORT_OPTIONS.frameCount),
  );
  const framesPerSecond = Math.max(
    1,
    Math.floor(options.framesPerSecond ?? DEFAULT_GIF_EXPORT_OPTIONS.framesPerSecond),
  );
  const outputWidthPx = Math.max(
    MIN_OUTPUT_WIDTH_PX,
    Math.floor(finiteNonNegative(options.outputWidthPx ?? DEFAULT_GIF_EXPORT_OPTIONS.outputWidthPx)),
  );
  const outputHeightPx = Math.max(
    MIN_OUTPUT_HEIGHT_PX,
    Math.floor(finiteNonNegative(options.outputHeightPx ?? DEFAULT_GIF_EXPORT_OPTIONS.outputHeightPx)),
  );
  const longExportStepThreshold = Math.max(
    1,
    Math.floor(options.longExportStepThreshold ?? DEFAULT_GIF_EXPORT_OPTIONS.longExportStepThreshold),
  );
  const simulatedDurationSeconds = Math.max(
    0,
    finiteNonNegative(
      options.simulatedDurationSeconds ?? DEFAULT_GIF_EXPORT_OPTIONS.simulatedDurationSeconds,
    ),
  );
  return {
    frameCount,
    framesPerSecond,
    outputWidthPx,
    outputHeightPx,
    longExportStepThreshold,
    simulatedDurationSeconds,
  };
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function sanitizeFilePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "export";
}
