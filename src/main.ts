import "./style.css";
import {
  DiagnosticsHistory,
  sparkline,
} from "./app/diagnosticsHistory";
import {
  formatElapsed,
  formatVector,
} from "./app/format";
import {
  DEFAULT_FIXED_TIMESTEP_SECONDS,
  DEFAULT_MAX_STEPS_PER_FRAME,
  DEFAULT_TIME_SCALE_SECONDS,
  findScenario,
  SCENARIOS,
  type ScenarioDefinition,
} from "./app/scenarios";
import { buildSelectedBodyDetail } from "./app/selectedBody";
import {
  loadVisualSettings,
  resetAllBodyScaleOverrides,
  resetBodyScaleOverride,
  saveVisualSettings,
  setBodyScaleOverride,
  visualSettingsToScaleMap,
  type VisualBodyScaleSettings,
} from "./app/visualSettings";
import type { HierarchicalBodyState, HierarchicalOrbitalBody } from "./domain/orbits";
import { magnitude } from "./domain/vector";
import {
  calculateConservedQuantities,
  relativeDrift,
  type ConservedQuantities,
} from "./physics/diagnostics";
import { DAY_SECONDS, J2000_ISO } from "./physics/constants";
import {
  propagateHierarchicalBodies,
  validateOrbitalHierarchy,
} from "./physics/hierarchicalOrbits";
import { calculateAccelerations } from "./physics/gravity";
import { NBodySimulation } from "./physics/simulation";
import {
  SolarSystemRenderer,
  type MarkerScaleMode,
  type TrailLengthPreset,
  type TrailMode,
  type ViewFrame,
} from "./rendering/SolarSystemRenderer";
import {
  filterNavigatorEntries,
  groupNavigatorEntries,
  type NavigatorCategory,
  type NavigatorEntry,
} from "./ui/navigator";

const MINIMUM_DISTANCE_M = 1_000;
const DIAGNOSTIC_INTERVAL_SECONDS = 30 * DAY_SECONDS;
const ENERGY_WARNING_DRIFT = 5e-5;
const ANGULAR_WARNING_DRIFT = 5e-5;

const GROUP_LABELS: Readonly<Partial<Record<NavigatorCategory, string>>> = {
  star: "Star",
  planet: "Planets",
  "dwarf-planet": "Dwarf Planets",
  moon: "Moons",
  comet: "Comets",
};

const TIME_SCALE_LABELS = new Map<string, string>([
  ["paused", "Paused"],
  ["1", "Real time"],
  ["3600", "1 hour/s"],
  ["86400", "1 day/s"],
  ["2592000", "30 days/s"],
  ["31557600", "1 year/s"],
]);

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing element "#${id}".`);
  return element as T;
}

function createSimulation(scenario: ScenarioDefinition): NBodySimulation {
  const bodies = scenario.createBodies();
  validateOrbitalHierarchy(
    scenario.orbitalBodies,
    bodies.map((body) => body.id),
  );
  return new NBodySimulation(bodies, {
    fixedTimestepSeconds: DEFAULT_FIXED_TIMESTEP_SECONDS,
    minimumDistanceM: MINIMUM_DISTANCE_M,
  });
}

function calculateOrbitalStates(
  orbitalDefinitions: readonly HierarchicalOrbitalBody[],
  simulation: NBodySimulation,
): HierarchicalBodyState[] {
  return propagateHierarchicalBodies(
    orbitalDefinitions,
    simulation.bodies,
    2_451_545 + simulation.elapsedSeconds / DAY_SECONDS,
  );
}

function formatTimeScale(seconds: number): string {
  if (seconds === 1) return "Real time";
  if (seconds < DAY_SECONDS) return `${(seconds / 3_600).toLocaleString()} hours/s`;
  if (seconds < 365 * DAY_SECONDS) return `${(seconds / DAY_SECONDS).toLocaleString()} days/s`;
  return `${(seconds / (365.25 * DAY_SECONDS)).toFixed(2)} years/s`;
}

function createNavigatorEntries(
  bodies: readonly { readonly id: string; readonly name: string; readonly category: NavigatorCategory }[],
  orbitalDefinitions: readonly HierarchicalOrbitalBody[],
  namesById: ReadonlyMap<string, string>,
): NavigatorEntry[] {
  return [
    ...bodies.map((body) => ({
      id: body.id,
      name: body.name,
      category: body.category,
      parentName: body.id === "sun" ? undefined : "Sun",
    })),
    ...orbitalDefinitions.map((body) => ({
      id: body.id,
      name: body.name,
      category: body.category,
      parentName: namesById.get(body.parentId),
    })),
  ];
}

const sceneElement = requireElement("scene");
const labelsElement = requireElement("labels");
const toggleButton = requireElement<HTMLButtonElement>("toggle");
const resetButton = requireElement<HTMLButtonElement>("reset");
const scenarioSelect = requireElement<HTMLSelectElement>("scenario");
const speedSelect = requireElement<HTMLSelectElement>("speed-select");
const customSpeedInput = requireElement<HTMLInputElement>("custom-speed");
const speedValue = requireElement<HTMLOutputElement>("speed-value");
const fitButton = requireElement<HTMLButtonElement>("fit");
const fitInnerButton = requireElement<HTMLButtonElement>("fit-inner");
const focusSunButton = requireElement<HTMLButtonElement>("focus-sun");
const focusSelectedButton = requireElement<HTMLButtonElement>("focus-selected");
const showAllButton = requireElement<HTMLButtonElement>("show-all");
const stopFollowButton = requireElement<HTMLButtonElement>("stop-follow");
const viewFrameSelect = requireElement<HTMLSelectElement>("view-frame");
const trailsInput = requireElement<HTMLInputElement>("trails");
const markerScaleModeSelect = requireElement<HTMLSelectElement>("marker-scale-mode");
const manualScaleEnabledInput = requireElement<HTMLInputElement>("manual-scale-enabled");
const manualScaleControls = requireElement("manual-scale-controls");
const bodyScaleNameElement = requireElement("body-scale-name");
const bodyScaleInput = requireElement<HTMLInputElement>("body-scale");
const bodyScaleValue = requireElement<HTMLOutputElement>("body-scale-value");
const resetBodyScaleButton = requireElement<HTMLButtonElement>("reset-body-scale");
const resetAllBodyScalesButton = requireElement<HTMLButtonElement>("reset-all-body-scales");
const trailModeSelect = requireElement<HTMLSelectElement>("trail-mode");
const trailLengthSelect = requireElement<HTMLSelectElement>("trail-length");
const clearTrailsButton = requireElement<HTMLButtonElement>("clear-trails");
const planetPathsInput = requireElement<HTMLInputElement>("planet-paths");
const mainBeltInput = requireElement<HTMLInputElement>("main-belt");
const kuiperBeltInput = requireElement<HTMLInputElement>("kuiper-belt");
const cometPathsInput = requireElement<HTMLInputElement>("comet-paths");
const cometTailsInput = requireElement<HTMLInputElement>("comet-tails");
const moonsInput = requireElement<HTMLInputElement>("moons-toggle");
const labelsInput = requireElement<HTMLInputElement>("labels-toggle");
const distanceScaleInput = requireElement<HTMLInputElement>("distance-scale");
const distanceScaleValue = requireElement<HTMLOutputElement>("distance-scale-value");
const searchInput = requireElement<HTMLInputElement>("body-search");
const searchResults = requireElement("body-results");
const statusElement = requireElement("status");
const dateElement = requireElement("date");
const elapsedElement = requireElement("elapsed");
const stepElement = requireElement("step");
const timeScaleElement = requireElement("time-scale");
const maxStepsElement = requireElement("max-steps");
const catchupElement = requireElement("catchup");
const energyDriftElement = requireElement("energy-drift");
const energySparkElement = requireElement("energy-spark");
const momentumDriftElement = requireElement("momentum-drift");
const angularSparkElement = requireElement("angular-spark");
const linearMomentumElement = requireElement("linear-momentum");
const angularMomentumElement = requireElement("angular-momentum");
const centerMassElement = requireElement("center-mass");
const diagnosticStatusElement = requireElement("diagnostic-status");
const stepsFrameElement = requireElement("steps-frame");
const selectedBodyElement = requireElement("selected-body");
const diagnosticsSection = document.querySelector<HTMLElement>(".diagnostics");
const datasetSourceElement = requireElement("dataset-source");
const datasetEpochElement = requireElement("dataset-epoch");
const datasetFrameElement = requireElement("dataset-frame");
const datasetNotesElement = requireElement("dataset-notes");

for (const scenario of SCENARIOS) {
  const option = document.createElement("option");
  option.value = scenario.id;
  option.textContent = scenario.label;
  scenarioSelect.append(option);
}

let currentScenario = findScenario(scenarioSelect.value || "full-solar-system");
let simulation = createSimulation(currentScenario);
let orbitalDefinitions = currentScenario.orbitalBodies;
let orbitalStates = calculateOrbitalStates(orbitalDefinitions, simulation);
let visualSettings: VisualBodyScaleSettings = loadVisualSettings(window.localStorage);
let renderer = createRenderer();
let running = true;
let accumulatorSeconds = 0;
let lastFrameTime = performance.now();
let timeScaleSeconds = DEFAULT_TIME_SCALE_SECONDS;
let initialConserved = calculateConservedQuantities(simulation.bodies);
let latestConserved: ConservedQuantities = initialConserved;
let lastDiagnosticsElapsed = Number.NEGATIVE_INFINITY;
let diagnosticsHistory = new DiagnosticsHistory();
let namesById = buildNamesById();
let navigatorEntries = createNavigatorEntries(simulation.bodies, orbitalDefinitions, namesById);
let selectedBodyId = currentScenario.defaultTargetId;
let filteredNavigatorEntries: NavigatorEntry[] = [];
let activeNavigatorIndex = 0;

function createRenderer(): SolarSystemRenderer {
  const sun = simulation.bodies.find((body) => body.id === "sun") ?? simulation.bodies[0];
  if (!sun) throw new Error("Scenario must include at least one massive body.");
  const instance = new SolarSystemRenderer(
    sceneElement,
    labelsElement,
    simulation.bodies,
    orbitalDefinitions,
    currentScenario.belts,
    sun.massKg,
  );
  instance.onBodySelected(selectAndFollow);
  instance.onFollowChanged((id) => {
    stopFollowButton.hidden = id === undefined;
    stopFollowButton.textContent = id ? `Stop Following ${namesById.get(id) ?? ""}` : "Stop Following";
  });
  return instance;
}

function buildNamesById(): Map<string, string> {
  return new Map<string, string>([
    ...simulation.bodies.map((body) => [body.id, body.name] as const),
    ...orbitalDefinitions.map((body) => [body.id, body.name] as const),
  ]);
}

function updateRunningUi(): void {
  toggleButton.textContent = running ? "Pause" : "Resume";
  statusElement.textContent = running ? "Running" : "Paused";
  statusElement.classList.toggle("paused", !running);
}

function saveAndApplyVisualSettings(next: VisualBodyScaleSettings): void {
  visualSettings = next;
  saveVisualSettings(window.localStorage, visualSettings);
  applyVisualSettingsToRenderer();
  updateManualScaleControls();
}

function applyVisualSettingsToRenderer(): void {
  renderer.setMarkerScaleMode(visualSettings.markerScaleMode);
  renderer.setManualBodyScaleEnabled(visualSettings.manualBodyScaleEnabled);
  renderer.setBodyScaleOverrides(visualSettingsToScaleMap(visualSettings));
}

function updateVisualSettingsControls(): void {
  markerScaleModeSelect.value = visualSettings.markerScaleMode;
  manualScaleEnabledInput.checked = visualSettings.manualBodyScaleEnabled;
  manualScaleControls.hidden = !visualSettings.manualBodyScaleEnabled;
  updateManualScaleControls();
}

function updateManualScaleControls(): void {
  const selectedName = namesById.get(selectedBodyId) ?? selectedBodyId;
  const selectedScale = visualSettings.bodyScaleOverrides[selectedBodyId] ?? 1;
  bodyScaleNameElement.textContent = selectedName;
  bodyScaleInput.value = selectedScale.toFixed(2);
  bodyScaleValue.value = `${selectedScale.toFixed(2)}x`;
}

function renderSelectedBody(): void {
  const accelerations = calculateAccelerations(simulation.bodies, MINIMUM_DISTANCE_M);
  const accelerationsById = new Map(
    simulation.bodies.map((body, index) => [body.id, accelerations[index] ?? { x: 0, y: 0, z: 0 }] as const),
  );
  const detail = buildSelectedBodyDetail({
    id: selectedBodyId,
    massiveBodies: simulation.bodies,
    orbitalStates,
    namesById,
    accelerationsById,
  });
  if (!detail) return;
  selectedBodyElement.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = detail.title;
  const list = document.createElement("dl");
  list.className = "detail-grid";
  for (const row of detail.rows) {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = row.label;
    description.textContent = row.value;
    item.append(term, description);
    list.append(item);
  }
  const note = document.createElement("p");
  note.className = "detail-note";
  note.textContent = detail.note;
  selectedBodyElement.append(title, list, note);
}

function selectAndFollow(id: string): void {
  selectedBodyId = id;
  renderer.selectBody(id);
  renderer.focusBody(id, true);
  renderer.setViewFrame(viewFrameSelect.value as ViewFrame, selectedBodyId);
  renderer.setTrailMode(trailModeSelect.value as TrailMode, selectedBodyId);
  renderSelectedBody();
  updateManualScaleControls();
  renderNavigator();
}

function renderNavigator(): void {
  filteredNavigatorEntries = filterNavigatorEntries(navigatorEntries, searchInput.value);
  activeNavigatorIndex = Math.min(
    activeNavigatorIndex,
    Math.max(filteredNavigatorEntries.length - 1, 0),
  );
  const groups = groupNavigatorEntries(filteredNavigatorEntries);
  searchResults.replaceChildren();
  let resultIndex = 0;
  for (const [category, entries] of groups) {
    const heading = document.createElement("div");
    heading.className = "navigator-group";
    heading.textContent = GROUP_LABELS[category] ?? category;
    searchResults.append(heading);
    for (const entry of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "navigator-result";
      if (resultIndex === activeNavigatorIndex) button.classList.add("active");
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(entry.id === selectedBodyId));
      const name = document.createElement("span");
      name.textContent = entry.name;
      const parent = document.createElement("small");
      parent.textContent = entry.parentName ?? entry.category;
      button.append(name, parent);
      button.addEventListener("click", () => selectAndFollow(entry.id));
      searchResults.append(button);
      resultIndex += 1;
    }
  }
  searchInput.setAttribute("aria-expanded", String(filteredNavigatorEntries.length > 0));
  searchResults.querySelector<HTMLElement>(".navigator-result.active")?.scrollIntoView({
    block: "nearest",
  });
}

function updateDatasetPanel(): void {
  datasetSourceElement.textContent = currentScenario.metadata.source;
  datasetEpochElement.textContent = currentScenario.metadata.epoch;
  datasetFrameElement.textContent = currentScenario.metadata.referenceFrame;
  datasetNotesElement.textContent = `${currentScenario.description} ${currentScenario.metadata.notes}`;
}

function resetDiagnostics(): void {
  initialConserved = calculateConservedQuantities(simulation.bodies);
  latestConserved = initialConserved;
  lastDiagnosticsElapsed = Number.NEGATIVE_INFINITY;
  diagnosticsHistory.reset();
}

function resetCurrentScenario(): void {
  simulation.reset();
  accumulatorSeconds = 0;
  orbitalStates = calculateOrbitalStates(orbitalDefinitions, simulation);
  resetDiagnostics();
  selectedBodyId = currentScenario.defaultTargetId;
  renderer.clearTrails();
  renderer.update(simulation.bodies, orbitalStates, simulation.elapsedSeconds);
  renderer.selectBody(selectedBodyId);
  renderer.stopFollowing();
  renderer.setViewFrame(viewFrameSelect.value as ViewFrame, selectedBodyId);
  renderer.setTrailMode(trailModeSelect.value as TrailMode, selectedBodyId);
  renderSelectedBody();
  updateManualScaleControls();
  renderNavigator();
}

function switchScenario(id: string): void {
  currentScenario = findScenario(id);
  orbitalDefinitions = currentScenario.orbitalBodies;
  simulation = createSimulation(currentScenario);
  orbitalStates = calculateOrbitalStates(orbitalDefinitions, simulation);
  namesById = buildNamesById();
  navigatorEntries = createNavigatorEntries(simulation.bodies, orbitalDefinitions, namesById);
  selectedBodyId = currentScenario.defaultTargetId;
  accumulatorSeconds = 0;
  activeNavigatorIndex = 0;
  searchInput.value = "";
  renderer.dispose();
  renderer = createRenderer();
  applyVisualSettingsToRenderer();
  renderer.setDistanceScale(Number(distanceScaleInput.value));
  renderer.setTrailsVisible(trailsInput.checked);
  renderer.setTrailMode(trailModeSelect.value as TrailMode, selectedBodyId);
  renderer.setTrailLengthPreset(trailLengthSelect.value as TrailLengthPreset);
  renderer.setViewFrame(viewFrameSelect.value as ViewFrame, selectedBodyId);
  renderer.setPlanetPathsVisible(planetPathsInput.checked);
  renderer.setBeltVisible("main-belt", mainBeltInput.checked);
  renderer.setBeltVisible("kuiper-belt", kuiperBeltInput.checked);
  renderer.setCometPathsVisible(cometPathsInput.checked);
  renderer.setCometTailsVisible(cometTailsInput.checked);
  renderer.setMoonsVisible(moonsInput.checked);
  renderer.setLabelsVisible(labelsInput.checked);
  resetDiagnostics();
  updateDatasetPanel();
  renderer.update(simulation.bodies, orbitalStates, simulation.elapsedSeconds);
  renderer.selectBody(selectedBodyId);
  renderer.focusBody(selectedBodyId, false);
  renderSelectedBody();
  updateManualScaleControls();
  renderNavigator();
}

function updateSpeedFromControls(): void {
  customSpeedInput.hidden = speedSelect.value !== "custom";
  if (speedSelect.value === "paused") {
    running = false;
    timeScaleSeconds = 0;
  } else if (speedSelect.value === "custom") {
    timeScaleSeconds = Math.max(1, Number(customSpeedInput.value) || DEFAULT_TIME_SCALE_SECONDS);
    running = true;
  } else {
    timeScaleSeconds = Number(speedSelect.value);
    running = true;
  }
  speedValue.value = timeScaleSeconds === 0 ? "Paused" : formatTimeScale(timeScaleSeconds);
  updateRunningUi();
}

function updateTelemetry(stepsThisFrame: number, clamped: boolean): void {
  const elapsed = simulation.elapsedSeconds;
  const currentDate = new Date(new Date(J2000_ISO).getTime() + elapsed * 1_000);
  dateElement.textContent = currentDate.toISOString().slice(0, 10);
  elapsedElement.textContent = formatElapsed(elapsed);
  stepElement.textContent = `${DEFAULT_FIXED_TIMESTEP_SECONDS / 3_600} hours`;
  timeScaleElement.textContent = speedValue.value;
  maxStepsElement.textContent = String(DEFAULT_MAX_STEPS_PER_FRAME);
  catchupElement.textContent = clamped ? "Clamped" : "Idle";
  stepsFrameElement.textContent = String(stepsThisFrame);

  if (elapsed - lastDiagnosticsElapsed >= DIAGNOSTIC_INTERVAL_SECONDS || elapsed === 0) {
    latestConserved = calculateConservedQuantities(simulation.bodies);
    diagnosticsHistory.add({
      elapsedSeconds: elapsed,
      energyDrift: relativeDrift(latestConserved.energyJ, initialConserved.energyJ),
      angularMomentumDrift: relativeDrift(
        magnitude(latestConserved.angularMomentumKgM2ps),
        magnitude(initialConserved.angularMomentumKgM2ps),
      ),
    });
    lastDiagnosticsElapsed = elapsed;
  }

  const status = diagnosticsHistory.status({
    bodies: simulation.bodies,
    current: latestConserved,
    energyWarningDrift: ENERGY_WARNING_DRIFT,
    angularMomentumWarningDrift: ANGULAR_WARNING_DRIFT,
  });
  const latest = status.samples.at(-1);
  energyDriftElement.textContent = `${(((latest?.energyDrift ?? 0) * 1e6)).toFixed(3)} ppm`;
  momentumDriftElement.textContent = `${(((latest?.angularMomentumDrift ?? 0) * 1e6)).toFixed(3)} ppm`;
  energySparkElement.textContent = sparkline(status.samples, "energyDrift");
  angularSparkElement.textContent = sparkline(status.samples, "angularMomentumDrift");
  linearMomentumElement.textContent = status.linearMomentumMagnitude.toExponential(3);
  angularMomentumElement.textContent = status.angularMomentumMagnitude.toExponential(3);
  centerMassElement.textContent = formatVector(status.centerOfMassM, "m");
  diagnosticStatusElement.textContent = status.warning ? "Drift warning" : "Stable";
  diagnosticStatusElement.classList.toggle("warning", status.warning);
  diagnosticsSection?.classList.toggle("warning", status.warning);
}

toggleButton.addEventListener("click", () => {
  running = !running;
  if (running && speedSelect.value === "paused") {
    speedSelect.value = String(DEFAULT_TIME_SCALE_SECONDS);
    updateSpeedFromControls();
    return;
  }
  if (!running) {
    speedSelect.value = "paused";
    updateSpeedFromControls();
    return;
  }
  updateRunningUi();
});
resetButton.addEventListener("click", resetCurrentScenario);
scenarioSelect.addEventListener("change", () => switchScenario(scenarioSelect.value));
speedSelect.addEventListener("change", updateSpeedFromControls);
customSpeedInput.addEventListener("input", updateSpeedFromControls);
fitButton.addEventListener("click", () => {
  renderer.stopFollowing();
  renderer.fitSystem();
});
fitInnerButton.addEventListener("click", () => {
  renderer.stopFollowing();
  renderer.fitInnerSystem();
});
focusSunButton.addEventListener("click", () => selectAndFollow("sun"));
focusSelectedButton.addEventListener("click", () => renderer.focusBody(selectedBodyId, true));
showAllButton.addEventListener("click", () => renderer.showAll());
stopFollowButton.addEventListener("click", () => renderer.stopFollowing());
viewFrameSelect.addEventListener("change", () => {
  renderer.setViewFrame(viewFrameSelect.value as ViewFrame, selectedBodyId);
});
markerScaleModeSelect.addEventListener("change", () => {
  saveAndApplyVisualSettings({
    ...visualSettings,
    markerScaleMode: markerScaleModeSelect.value as MarkerScaleMode,
  });
});
manualScaleEnabledInput.addEventListener("change", () => {
  saveAndApplyVisualSettings({
    ...visualSettings,
    manualBodyScaleEnabled: manualScaleEnabledInput.checked,
  });
});
bodyScaleInput.addEventListener("input", () => {
  saveAndApplyVisualSettings(
    setBodyScaleOverride(visualSettings, selectedBodyId, Number(bodyScaleInput.value)),
  );
});
resetBodyScaleButton.addEventListener("click", () => {
  saveAndApplyVisualSettings(resetBodyScaleOverride(visualSettings, selectedBodyId));
});
resetAllBodyScalesButton.addEventListener("click", () => {
  saveAndApplyVisualSettings(resetAllBodyScaleOverrides(visualSettings));
});
trailsInput.addEventListener("change", () => renderer.setTrailsVisible(trailsInput.checked));
trailModeSelect.addEventListener("change", () => {
  renderer.setTrailMode(trailModeSelect.value as TrailMode, selectedBodyId);
});
trailLengthSelect.addEventListener("change", () => {
  renderer.setTrailLengthPreset(trailLengthSelect.value as TrailLengthPreset);
});
clearTrailsButton.addEventListener("click", () => renderer.clearTrails());
planetPathsInput.addEventListener("change", () =>
  renderer.setPlanetPathsVisible(planetPathsInput.checked),
);
mainBeltInput.addEventListener("change", () =>
  renderer.setBeltVisible("main-belt", mainBeltInput.checked),
);
kuiperBeltInput.addEventListener("change", () =>
  renderer.setBeltVisible("kuiper-belt", kuiperBeltInput.checked),
);
cometPathsInput.addEventListener("change", () =>
  renderer.setCometPathsVisible(cometPathsInput.checked),
);
cometTailsInput.addEventListener("change", () =>
  renderer.setCometTailsVisible(cometTailsInput.checked),
);
moonsInput.addEventListener("change", () => renderer.setMoonsVisible(moonsInput.checked));
labelsInput.addEventListener("change", () => renderer.setLabelsVisible(labelsInput.checked));
distanceScaleInput.addEventListener("input", () => {
  const scale = Number(distanceScaleInput.value);
  renderer.setDistanceScale(scale);
  distanceScaleValue.value = scale === 1 ? "1x physical" : `${scale}x all`;
});
searchInput.addEventListener("input", () => {
  activeNavigatorIndex = 0;
  renderNavigator();
});
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeNavigatorIndex = Math.min(
      activeNavigatorIndex + 1,
      filteredNavigatorEntries.length - 1,
    );
    renderNavigator();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    activeNavigatorIndex = Math.max(activeNavigatorIndex - 1, 0);
    renderNavigator();
  } else if (event.key === "Enter") {
    event.preventDefault();
    const entry = filteredNavigatorEntries[activeNavigatorIndex];
    if (entry) selectAndFollow(entry.id);
  } else if (event.key === "Escape") {
    searchInput.value = "";
    activeNavigatorIndex = 0;
    renderNavigator();
    searchInput.blur();
  }
});

function frame(now: number): void {
  const realDeltaSeconds = Math.min((now - lastFrameTime) / 1_000, 0.1);
  lastFrameTime = now;
  let stepsThisFrame = 0;
  let clamped = false;
  if (running && timeScaleSeconds > 0) {
    accumulatorSeconds += realDeltaSeconds * timeScaleSeconds;
    while (
      accumulatorSeconds >= simulation.fixedTimestepSeconds &&
      stepsThisFrame < DEFAULT_MAX_STEPS_PER_FRAME
    ) {
      simulation.step();
      accumulatorSeconds -= simulation.fixedTimestepSeconds;
      stepsThisFrame += 1;
    }
    if (stepsThisFrame === DEFAULT_MAX_STEPS_PER_FRAME) {
      accumulatorSeconds = Math.min(accumulatorSeconds, simulation.fixedTimestepSeconds);
      clamped = true;
    }
  }
  orbitalStates = calculateOrbitalStates(orbitalDefinitions, simulation);
  renderer.update(simulation.bodies, orbitalStates, simulation.elapsedSeconds);
  renderer.render();
  updateTelemetry(stepsThisFrame, clamped);
  renderSelectedBody();
  requestAnimationFrame(frame);
}

scenarioSelect.value = currentScenario.id;
speedSelect.value = String(DEFAULT_TIME_SCALE_SECONDS);
speedValue.value = TIME_SCALE_LABELS.get(speedSelect.value) ?? formatTimeScale(timeScaleSeconds);
updateDatasetPanel();
updateRunningUi();
updateVisualSettingsControls();
applyVisualSettingsToRenderer();
renderer.selectBody(selectedBodyId);
renderer.focusBody(selectedBodyId, false);
renderer.update(simulation.bodies, orbitalStates, 0);
renderSelectedBody();
renderNavigator();
requestAnimationFrame(frame);
