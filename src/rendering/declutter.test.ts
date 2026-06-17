import { describe, expect, it } from "vitest";
import { calculateDeclutterVisibility, type DeclutterItem } from "./declutter";

const baseItem: DeclutterItem = {
  id: "earth",
  category: "planet",
  screenXPx: 100,
  screenYPx: 100,
  markerRadiusPx: 10,
  selected: false,
  baseVisible: true,
};

describe("calculateDeclutterVisibility", () => {
  it("hides a lower-priority item when it overlaps a higher-priority item", () => {
    const result = calculateDeclutterVisibility(
      [
        baseItem,
        {
          ...baseItem,
          id: "moon",
          category: "moon",
          screenXPx: 105,
        },
      ],
      { viewportWidthPx: 500, viewportHeightPx: 500, paddingPx: 0 },
    );

    expect(result.visibleIds.has("earth")).toBe(true);
    expect(result.visibleIds.has("moon")).toBe(false);
    expect(result.hiddenIds.has("moon")).toBe(true);
  });

  it("keeps the selected body visible even when it has lower category priority", () => {
    const result = calculateDeclutterVisibility(
      [
        baseItem,
        {
          ...baseItem,
          id: "pluto",
          category: "dwarf-planet",
          selected: true,
          screenXPx: 105,
        },
      ],
      { viewportWidthPx: 500, viewportHeightPx: 500, paddingPx: 0 },
    );

    expect(result.visibleIds.has("pluto")).toBe(true);
    expect(result.visibleIds.has("earth")).toBe(true);
  });

  it("keeps planet markers visible even when they overlap the Sun", () => {
    const result = calculateDeclutterVisibility(
      [
        {
          ...baseItem,
          id: "sun",
          category: "star",
          markerRadiusPx: 16,
        },
        {
          ...baseItem,
          id: "mercury",
          category: "planet",
          markerRadiusPx: 8,
          screenXPx: 104,
        },
      ],
      { viewportWidthPx: 500, viewportHeightPx: 500, paddingPx: 4 },
    );

    expect(result.visibleIds.has("sun")).toBe(true);
    expect(result.visibleIds.has("mercury")).toBe(true);
  });

  it("keeps spacecraft markers visible when they overlap a planet", () => {
    const result = calculateDeclutterVisibility(
      [
        baseItem,
        {
          ...baseItem,
          id: "spacecraft-active",
          category: "spacecraft",
          markerRadiusPx: 7,
          screenXPx: 104,
        },
      ],
      { viewportWidthPx: 500, viewportHeightPx: 500, paddingPx: 4 },
    );

    expect(result.visibleIds.has("earth")).toBe(true);
    expect(result.visibleIds.has("spacecraft-active")).toBe(true);
  });

  it("keeps non-overlapping items visible", () => {
    const result = calculateDeclutterVisibility(
      [
        baseItem,
        {
          ...baseItem,
          id: "mars",
          screenXPx: 200,
        },
      ],
      { viewportWidthPx: 500, viewportHeightPx: 500, paddingPx: 4 },
    );

    expect(result.visibleIds.has("earth")).toBe(true);
    expect(result.visibleIds.has("mars")).toBe(true);
    expect(result.hiddenIds.size).toBe(0);
  });

  it("uses pixel radii and padding for overlap detection", () => {
    const result = calculateDeclutterVisibility(
      [
        { ...baseItem, markerRadiusPx: 4 },
        {
          ...baseItem,
          id: "encke",
          category: "comet",
          screenXPx: 109,
          markerRadiusPx: 4,
        },
      ],
      { viewportWidthPx: 500, viewportHeightPx: 500, paddingPx: 2 },
    );

    expect(result.visibleIds.has("earth")).toBe(true);
    expect(result.visibleIds.has("encke")).toBe(false);
  });

  it("does not let base-hidden items hide visible items", () => {
    const result = calculateDeclutterVisibility(
      [
        { ...baseItem, id: "sun", category: "star", baseVisible: false },
        {
          ...baseItem,
          id: "mercury",
          screenXPx: 100,
        },
      ],
      { viewportWidthPx: 500, viewportHeightPx: 500, paddingPx: 0 },
    );

    expect(result.visibleIds.has("mercury")).toBe(true);
    expect(result.hiddenIds.has("sun")).toBe(true);
  });

  it("can hide overlapping labels while keeping planet markers visible", () => {
    const result = calculateDeclutterVisibility(
      [
        {
          ...baseItem,
          selected: true,
          labelWidthPx: 40,
          labelHeightPx: 12,
        },
        {
          ...baseItem,
          id: "mars",
          screenXPx: 115,
          labelWidthPx: 40,
          labelHeightPx: 12,
        },
      ],
      { viewportWidthPx: 500, viewportHeightPx: 500, paddingPx: 4 },
    );

    expect(result.visibleIds.has("earth")).toBe(true);
    expect(result.visibleIds.has("mars")).toBe(true);
    expect(result.labelVisibleIds.has("earth")).toBe(true);
    expect(result.labelHiddenIds.has("mars")).toBe(true);
  });

  it("keeps a protected moon marker visible when it overlaps its parent planet", () => {
    const result = calculateDeclutterVisibility(
      [
        baseItem,
        {
          ...baseItem,
          id: "moon",
          category: "moon",
          screenXPx: 105,
          protectMarker: true,
        },
      ],
      { viewportWidthPx: 500, viewportHeightPx: 500, paddingPx: 0 },
    );

    expect(result.visibleIds.has("earth")).toBe(true);
    expect(result.visibleIds.has("moon")).toBe(true);
    expect(result.hiddenIds.has("moon")).toBe(false);
  });

  it("can still hide a protected moon label when the label is crowded", () => {
    const result = calculateDeclutterVisibility(
      [
        {
          ...baseItem,
          selected: true,
          labelWidthPx: 40,
          labelHeightPx: 12,
        },
        {
          ...baseItem,
          id: "moon",
          category: "moon",
          screenXPx: 104,
          markerRadiusPx: 8,
          protectMarker: true,
          labelWidthPx: 40,
          labelHeightPx: 12,
        },
      ],
      { viewportWidthPx: 500, viewportHeightPx: 500, paddingPx: 4 },
    );

    expect(result.visibleIds.has("moon")).toBe(true);
    expect(result.labelVisibleIds.has("earth")).toBe(true);
    expect(result.labelHiddenIds.has("moon")).toBe(true);
  });
});
