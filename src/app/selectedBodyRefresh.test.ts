import { describe, expect, it } from "vitest";
import { shouldRefreshSelectedBodyDetail } from "./selectedBodyRefresh";

describe("shouldRefreshSelectedBodyDetail", () => {
  const previous = {
    bodyId: "earth",
    elapsedSeconds: 100,
    refreshedAtMs: 1_000,
  };

  it("refreshes when forced or when the selected body changes", () => {
    expect(
      shouldRefreshSelectedBodyDetail({
        force: true,
        bodyId: "earth",
        elapsedSeconds: 100,
        nowMs: 1_001,
        minimumIntervalMs: 1_000,
        previous,
      }),
    ).toBe(true);
    expect(
      shouldRefreshSelectedBodyDetail({
        force: false,
        bodyId: "mars",
        elapsedSeconds: 100,
        nowMs: 1_001,
        minimumIntervalMs: 1_000,
        previous,
      }),
    ).toBe(true);
  });

  it("refreshes after physics time advances", () => {
    expect(
      shouldRefreshSelectedBodyDetail({
        force: false,
        bodyId: "earth",
        elapsedSeconds: 400,
        nowMs: 1_001,
        minimumIntervalMs: 1_000,
        previous,
      }),
    ).toBe(true);
  });

  it("throttles unchanged paused views until the interval expires", () => {
    expect(
      shouldRefreshSelectedBodyDetail({
        force: false,
        bodyId: "earth",
        elapsedSeconds: 100,
        nowMs: 1_500,
        minimumIntervalMs: 1_000,
        previous,
      }),
    ).toBe(false);
    expect(
      shouldRefreshSelectedBodyDetail({
        force: false,
        bodyId: "earth",
        elapsedSeconds: 100,
        nowMs: 2_000,
        minimumIntervalMs: 1_000,
        previous,
      }),
    ).toBe(true);
  });
});
