import type { MutableBodyState } from "../domain/types";
import { subtract } from "../domain/vector";
import { GRAVITATIONAL_CONSTANT } from "../physics/constants";
import { stateToOsculatingElements } from "../physics/orbitalMechanics";
import type { NBodySimulation } from "../physics/simulation";

const TWO_PI = Math.PI * 2;

export interface GifExportOptions {
  readonly frameCount: number;
  readonly framesPerSecond: number;
  readonly maximumDimensionPx: number;
  readonly longExportStepThreshold: number;
}

export interface GifExportEstimate {
  readonly selectedBodyId: string;
  readonly centralBodyId: string;
  readonly periodSeconds: number;
  readonly apoapsisM: number;
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
  maximumDimensionPx: 720,
  longExportStepThreshold: 250_000,
});

export function estimateSelectedOrbitGifExport(input: {
  readonly selectedBodyId: string;
  readonly scenarioId: string;
  readonly simulation: NBodySimulation;
  readonly options?: Partial<GifExportOptions>;
}): GifExportEstimate {
  const options = normalizeGifExportOptions(input.options);
  const selected = input.simulation.bodies.find((body) => body.id === input.selectedBodyId);
  if (!selected) {
    throw new Error("GIF export is available only for physical N-body objects.");
  }
  if (selected.category === "star") {
    throw new Error("Select a planet, moon, dwarf planet, or minor body to export one orbit.");
  }

  const central = resolveCentralBody(selected, input.simulation.bodies);
  const relativePositionM = subtract(selected.positionM, central.positionM);
  const relativeVelocityMps = subtract(selected.velocityMps, central.velocityMps);
  const elements = stateToOsculatingElements(
    relativePositionM,
    relativeVelocityMps,
    central.massKg + selected.massKg,
    0,
  );

  if (
    !(elements.semiMajorAxisM > 0) ||
    !Number.isFinite(elements.semiMajorAxisM) ||
    elements.eccentricity >= 1 ||
    !Number.isFinite(elements.eccentricity)
  ) {
    throw new Error("The selected body is not currently on a bounded elliptical orbit.");
  }

  const periodSeconds = orbitalPeriodSeconds(
    elements.semiMajorAxisM,
    central.massKg + selected.massKg,
  );
  if (!(periodSeconds > 0) || !Number.isFinite(periodSeconds)) {
    throw new Error("Could not derive a finite orbital period for the selected body.");
  }

  const physicsStepCount = Math.ceil(periodSeconds / input.simulation.fixedTimestepSeconds);
  return {
    selectedBodyId: selected.id,
    centralBodyId: central.id,
    periodSeconds,
    apoapsisM: elements.semiMajorAxisM * (1 + elements.eccentricity),
    frameCount: options.frameCount,
    framesPerSecond: options.framesPerSecond,
    frameDelayMs: Math.round(1_000 / options.framesPerSecond),
    physicsStepCount,
    requiresConfirmation: physicsStepCount > options.longExportStepThreshold,
    fileName: `solar-system-${sanitizeFilePart(input.scenarioId)}-${sanitizeFilePart(selected.id)}-orbit.gif`,
  };
}

export function normalizeGifExportOptions(options: Partial<GifExportOptions> = {}): GifExportOptions {
  const frameCount = Math.max(2, Math.floor(options.frameCount ?? DEFAULT_GIF_EXPORT_OPTIONS.frameCount));
  const framesPerSecond = Math.max(
    1,
    Math.floor(options.framesPerSecond ?? DEFAULT_GIF_EXPORT_OPTIONS.framesPerSecond),
  );
  const maximumDimensionPx = Math.max(
    64,
    Math.floor(options.maximumDimensionPx ?? DEFAULT_GIF_EXPORT_OPTIONS.maximumDimensionPx),
  );
  const longExportStepThreshold = Math.max(
    1,
    Math.floor(options.longExportStepThreshold ?? DEFAULT_GIF_EXPORT_OPTIONS.longExportStepThreshold),
  );
  return { frameCount, framesPerSecond, maximumDimensionPx, longExportStepThreshold };
}

export function resolveCentralBody(
  selected: Readonly<MutableBodyState>,
  bodies: readonly Readonly<MutableBodyState>[],
): Readonly<MutableBodyState> {
  if (selected.parentId) {
    const parent = bodies.find((body) => body.id === selected.parentId);
    if (!parent) throw new Error(`The selected body's parent "${selected.parentId}" is not loaded.`);
    return parent;
  }

  const sun = bodies.find((body) => body.id === "sun");
  if (sun && sun.id !== selected.id) return sun;

  const stars = bodies
    .filter((body) => body.category === "star" && body.id !== selected.id)
    .sort((a, b) => b.massKg - a.massKg);
  const central = stars[0];
  if (!central) throw new Error("No central star is available for this export.");
  return central;
}

export function orbitalPeriodSeconds(semiMajorAxisM: number, centralMassKg: number): number {
  return TWO_PI * Math.sqrt(semiMajorAxisM ** 3 / (GRAVITATIONAL_CONSTANT * centralMassKg));
}

function sanitizeFilePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "export";
}
