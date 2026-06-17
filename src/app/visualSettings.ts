import { clampBodyScale, type MarkerScaleMode } from "../rendering/markerSizing";

export interface VisualBodyScaleSettings {
  readonly version: 1;
  readonly markerScaleMode: MarkerScaleMode;
  readonly manualBodyScaleEnabled: boolean;
  readonly bodyScaleOverrides: Readonly<Record<string, number>>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const VISUAL_SETTINGS_KEY = "solarSystem.visualSettings.v1";

export const DEFAULT_VISUAL_SETTINGS: VisualBodyScaleSettings = Object.freeze({
  version: 1,
  markerScaleMode: "readable",
  manualBodyScaleEnabled: false,
  bodyScaleOverrides: Object.freeze({}),
});

export function loadVisualSettings(storage: StorageLike): VisualBodyScaleSettings {
  const raw = storage.getItem(VISUAL_SETTINGS_KEY);
  if (!raw) return DEFAULT_VISUAL_SETTINGS;
  try {
    return parseVisualSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_VISUAL_SETTINGS;
  }
}

export function saveVisualSettings(storage: StorageLike, settings: VisualBodyScaleSettings): void {
  storage.setItem(VISUAL_SETTINGS_KEY, JSON.stringify(settings));
}

export function parseVisualSettings(value: unknown): VisualBodyScaleSettings {
  if (!value || typeof value !== "object") return DEFAULT_VISUAL_SETTINGS;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return DEFAULT_VISUAL_SETTINGS;
  const markerScaleMode =
    record.markerScaleMode === "physical" || record.markerScaleMode === "readable"
      ? record.markerScaleMode
      : DEFAULT_VISUAL_SETTINGS.markerScaleMode;
  const manualBodyScaleEnabled =
    typeof record.manualBodyScaleEnabled === "boolean"
      ? record.manualBodyScaleEnabled
      : DEFAULT_VISUAL_SETTINGS.manualBodyScaleEnabled;
  const bodyScaleOverrides: Record<string, number> = {};
  if (record.bodyScaleOverrides && typeof record.bodyScaleOverrides === "object") {
    for (const [id, scale] of Object.entries(record.bodyScaleOverrides)) {
      if (!id || typeof scale !== "number" || !Number.isFinite(scale)) continue;
      bodyScaleOverrides[id] = clampBodyScale(scale);
    }
  }
  return {
    version: 1,
    markerScaleMode,
    manualBodyScaleEnabled,
    bodyScaleOverrides,
  };
}

export function setBodyScaleOverride(
  settings: VisualBodyScaleSettings,
  bodyId: string,
  scale: number,
): VisualBodyScaleSettings {
  return {
    ...settings,
    bodyScaleOverrides: {
      ...settings.bodyScaleOverrides,
      [bodyId]: clampBodyScale(scale),
    },
  };
}

export function resetBodyScaleOverride(
  settings: VisualBodyScaleSettings,
  bodyId: string,
): VisualBodyScaleSettings {
  const { [bodyId]: _removed, ...remaining } = settings.bodyScaleOverrides;
  return {
    ...settings,
    bodyScaleOverrides: remaining,
  };
}

export function resetAllBodyScaleOverrides(
  settings: VisualBodyScaleSettings,
): VisualBodyScaleSettings {
  return {
    ...settings,
    bodyScaleOverrides: {},
  };
}

export function visualSettingsToScaleMap(
  settings: VisualBodyScaleSettings,
): ReadonlyMap<string, number> {
  return new Map(Object.entries(settings.bodyScaleOverrides));
}
