import type { OrbitalBodyCategory } from "../domain/orbits";
import type { BodyCategory } from "../domain/types";

export type NavigatorCategory = BodyCategory | OrbitalBodyCategory | "comet";

export interface NavigatorEntry {
  readonly id: string;
  readonly name: string;
  readonly category: NavigatorCategory;
  readonly parentName?: string;
}

const GROUP_ORDER: readonly NavigatorCategory[] = [
  "star",
  "planet",
  "dwarf-planet",
  "moon",
  "comet",
  "minor-body",
];

export function filterNavigatorEntries(
  entries: readonly NavigatorEntry[],
  query: string,
): NavigatorEntry[] {
  const normalized = query.trim().toLocaleLowerCase();
  return entries
    .filter((entry) => {
      if (!normalized) return true;
      return `${entry.name} ${entry.parentName ?? ""} ${entry.category}`
        .toLocaleLowerCase()
        .includes(normalized);
    })
    .sort((a, b) => {
      const groupDifference =
        GROUP_ORDER.indexOf(a.category) - GROUP_ORDER.indexOf(b.category);
      return groupDifference || a.name.localeCompare(b.name);
    });
}

export function groupNavigatorEntries(
  entries: readonly NavigatorEntry[],
): Map<NavigatorCategory, NavigatorEntry[]> {
  const groups = new Map<NavigatorCategory, NavigatorEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.category) ?? [];
    group.push(entry);
    groups.set(entry.category, group);
  }
  return groups;
}
