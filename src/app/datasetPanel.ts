import type { ScenarioDefinition } from "./scenarios";

export function formatDatasetNotes(scenario: ScenarioDefinition): string {
  return (
    `${scenario.description} ${scenario.metadata.notes} ` +
    `Units: ${scenario.metadata.originalUnits}. ` +
    `Conversion: ${scenario.metadata.conversionApplied}`
  );
}
