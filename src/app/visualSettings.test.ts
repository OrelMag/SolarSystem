import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISUAL_SETTINGS,
  loadVisualSettings,
  resetAllBodyScaleOverrides,
  resetBodyScaleOverride,
  saveVisualSettings,
  setBodyScaleOverride,
  visualSettingsToScaleMap,
  type StorageLike,
} from "./visualSettings";

class MemoryStorage implements StorageLike {
  private value: string | null = null;

  getItem(): string | null {
    return this.value;
  }

  setItem(_key: string, value: string): void {
    this.value = value;
  }
}

describe("visual settings", () => {
  it("falls back to defaults for missing or invalid storage", () => {
    const storage = new MemoryStorage();
    expect(loadVisualSettings(storage)).toEqual(DEFAULT_VISUAL_SETTINGS);
    storage.setItem("x", "{bad");
    expect(loadVisualSettings(storage)).toEqual(DEFAULT_VISUAL_SETTINGS);
  });

  it("saves, loads, and clamps per-body overrides by stable id", () => {
    const storage = new MemoryStorage();
    const settings = setBodyScaleOverride(
      {
        version: 1,
        markerScaleMode: "physical",
        manualBodyScaleEnabled: true,
        bodyScaleOverrides: {},
      },
      "earth",
      8,
    );
    saveVisualSettings(storage, settings);
    const loaded = loadVisualSettings(storage);
    expect(loaded.markerScaleMode).toBe("physical");
    expect(loaded.bodyScaleOverrides.earth).toBe(4);
    expect(visualSettingsToScaleMap(loaded).get("earth")).toBe(4);
  });

  it("resets selected or all scale overrides", () => {
    const settings = {
      version: 1 as const,
      markerScaleMode: "readable" as const,
      manualBodyScaleEnabled: true,
      bodyScaleOverrides: { earth: 2, mars: 0.5 },
    };
    expect(resetBodyScaleOverride(settings, "earth").bodyScaleOverrides).toEqual({
      mars: 0.5,
    });
    expect(resetAllBodyScaleOverrides(settings).bodyScaleOverrides).toEqual({});
  });
});
