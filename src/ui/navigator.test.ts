import { describe, expect, it } from "vitest";
import {
  filterNavigatorEntries,
  groupNavigatorEntries,
  type NavigatorEntry,
} from "./navigator";

const entries: readonly NavigatorEntry[] = [
  { id: "earth", name: "Earth", category: "planet", parentName: "Sun" },
  { id: "moon", name: "Moon", category: "moon", parentName: "Earth" },
  { id: "europa", name: "Europa", category: "moon", parentName: "Jupiter" },
  { id: "halley", name: "1P/Halley", category: "comet", parentName: "Sun" },
];

describe("body navigator", () => {
  it("searches names, categories, and parent names case-insensitively", () => {
    expect(filterNavigatorEntries(entries, "EARTH").map((entry) => entry.id)).toEqual([
      "earth",
      "moon",
    ]);
    expect(filterNavigatorEntries(entries, "comet").map((entry) => entry.id)).toEqual([
      "halley",
    ]);
  });

  it("groups sorted results by body category", () => {
    const filtered = filterNavigatorEntries(entries, "");
    const groups = groupNavigatorEntries(filtered);
    expect([...groups.keys()]).toEqual(["planet", "moon", "comet"]);
    expect(groups.get("moon")?.map((entry) => entry.name)).toEqual(["Europa", "Moon"]);
  });
});
