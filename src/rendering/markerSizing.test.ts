import { describe, expect, it } from "vitest";
import {
  calculateMarkerSizing,
  calculatePhysicalMarkerRadius,
  clampBodyScale,
  shouldUsePlanetDotMarkers,
} from "./markerSizing";

describe("marker sizing", () => {
  it("keeps readable markers stable in pixels across camera zoom", () => {
    const base = {
      mode: "readable" as const,
      category: "planet" as const,
      physicalRadiusM: 6_371_000,
      baseWorldRadius: 0.2,
      selected: false,
      viewportHeightPx: 1_000,
      cameraWorldHeight: 110,
      manualScaleEnabled: false,
      manualScale: undefined,
    };
    const far = calculateMarkerSizing({ ...base, cameraZoom: 1 });
    const near = calculateMarkerSizing({ ...base, cameraZoom: 10 });
    expect(far.pixelRadius).toBe(near.pixelRadius);
    expect(near.worldRadius).toBeLessThan(far.worldRadius);
  });

  it("preserves physical base radius in physical mode", () => {
    expect(
      calculateMarkerSizing({
        mode: "physical",
        category: "planet",
        physicalRadiusM: 6_371_000,
        baseWorldRadius: 0.25,
        selected: true,
        cameraZoom: 2,
        viewportHeightPx: 1_000,
        cameraWorldHeight: 110,
        manualScaleEnabled: false,
        manualScale: undefined,
      }).worldRadius,
    ).toBe(0.25);
  });

  it("applies selected emphasis and clamps manual override", () => {
    const sizing = calculateMarkerSizing({
      mode: "readable",
      category: "planet",
      physicalRadiusM: 6_371_000,
      baseWorldRadius: 0.2,
      selected: true,
      cameraZoom: 1,
      viewportHeightPx: 1_000,
      cameraWorldHeight: 110,
      manualScaleEnabled: true,
      manualScale: 99,
    });
    expect(sizing.pixelRadius).toBe((14 + 3) * 4);
    expect(clampBodyScale(0.01)).toBe(0.25);
    expect(calculatePhysicalMarkerRadius("star", 1)).toBe(0.22);
  });

  it("uses compact dot radius for planets when requested", () => {
    expect(
      calculateMarkerSizing({
        mode: "readable",
        category: "planet",
        physicalRadiusM: 6_371_000,
        baseWorldRadius: 0.2,
        selected: false,
        cameraZoom: 1,
        viewportHeightPx: 1_000,
        cameraWorldHeight: 110,
        manualScaleEnabled: false,
        manualScale: undefined,
        compactPrimaryMarkers: true,
      }).pixelRadius,
    ).toBe(5);
  });

  it("uses compact radius for the Sun when primary markers overlap", () => {
    expect(
      calculateMarkerSizing({
        mode: "readable",
        category: "star",
        physicalRadiusM: 696_340_000,
        baseWorldRadius: 0.22,
        selected: false,
        cameraZoom: 1,
        viewportHeightPx: 1_000,
        cameraWorldHeight: 110,
        manualScaleEnabled: false,
        manualScale: undefined,
        compactPrimaryMarkers: true,
      }).pixelRadius,
    ).toBe(9);
  });

  it("caps manual overrides for compact primary dots", () => {
    expect(
      calculateMarkerSizing({
        mode: "readable",
        category: "planet",
        physicalRadiusM: 6_371_000,
        baseWorldRadius: 0.2,
        selected: true,
        cameraZoom: 1,
        viewportHeightPx: 1_000,
        cameraWorldHeight: 110,
        manualScaleEnabled: true,
        manualScale: 4,
        compactPrimaryMarkers: true,
      }).pixelRadius,
    ).toBe(8.75);
  });

  it("detects Sun-planet and planet-planet marker overlap in screen pixels", () => {
    expect(
      shouldUsePlanetDotMarkers([
        {
          category: "star",
          screenXPx: 100,
          screenYPx: 100,
          pixelRadius: 22,
          baseVisible: true,
        },
        {
          category: "planet",
          screenXPx: 130,
          screenYPx: 100,
          pixelRadius: 14,
          baseVisible: true,
        },
      ]),
    ).toBe(true);
    expect(
      shouldUsePlanetDotMarkers([
        {
          category: "planet",
          screenXPx: 100,
          screenYPx: 100,
          pixelRadius: 14,
          baseVisible: true,
        },
        {
          category: "planet",
          screenXPx: 300,
          screenYPx: 100,
          pixelRadius: 14,
          baseVisible: true,
        },
      ]),
    ).toBe(false);
  });
});
