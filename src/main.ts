import "./style.css";
import { BELT_DEFINITIONS, generateBeltParticles } from "./data/belts";
import { MASSIVE_BODY_FACTS } from "./data/bodyFacts";
import { COMETS } from "./data/comets";
import { EXPLORATION_BODIES } from "./data/satellites";
import { createSolarSystem } from "./data/solarSystem";
import type {
  HierarchicalBodyState,
  HierarchicalOrbitalBody,
} from "./domain/orbits";
import { magnitude, subtract } from "./domain/vector";
import {
  calculateConservedQuantities,
  relativeDrift,
} from "./physics/diagnostics";
import {
  ASTRONOMICAL_UNIT_M,
  DAY_SECONDS,
  GRAVITATIONAL_CONSTANT,
  J2000_ISO,
} from "./physics/constants";
import {
  propagateHierarchicalBodies,
  validateOrbitalHierarchy,
} from "./physics/hierarchicalOrbits";
import {
  J2000_JULIAN_DAY,
  stateToOsculatingElements,
} from "./physics/orbitalMechanics";
import { NBodySimulation } from "./physics/simulation";
import { SolarSystemRenderer } from "./rendering/SolarSystemRenderer";
import {
  filterNavigatorEntries,
  groupNavigatorEntries,
  type NavigatorCategory,
  type NavigatorEntry,
} from "./ui/navigator";

const FIXED_TIMESTEP_SECONDS = 3 * 3_600;
const MAX_STEPS_PER_FRAME = 80;
const TIME_SCALES = [
  { label: "1 hour/s", seconds: 3_600 },
  { label: "6 hours/s", seconds: 21_600 },
  { label: "1 day/s", seconds: DAY_SECONDS },
  { label: "30 days/s", seconds: 30 * DAY_SECONDS },
  { label: "90 days/s", seconds: 90 * DAY_SECONDS },
  { label: "180 days/s", seconds: 180 * DAY_SECONDS },
  { label: "1 year/s", seconds: 365.25 * DAY_SECONDS },
] as const;

const GROUP_LABELS: Readonly<Partial<Record<NavigatorCategory, string>>> = {
  star: "Star",
  planet: "Planets",
  "dwarf-planet": "Dwarf Planets",
  moon: "Moons",
  comet: "Comets",
};

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing element "#${id}".`);
  return element as T;
}

const initialBodies = createSolarSystem();
const initialSun = initialBodies.find((body) => body.id === "sun");
if (!initialSun) throw new Error("Solar dataset must include the Sun.");
const orbitalDefinitions: readonly HierarchicalOrbitalBody[] = [
  ...COMETS,
  ...EXPLORATION_BODIES,
];
validateOrbitalHierarchy(
  orbitalDefinitions,
  initialBodies.map((body) => body.id),
);

const simulation = new NBodySimulation(initialBodies, {
  fixedTimestepSeconds: FIXED_TIMESTEP_SECONDS,
  minimumDistanceM: 1_000,
});
const belts = BELT_DEFINITIONS.map((definition) => ({
  definition,
  particles: generateBeltParticles(definition),
}));
const renderer = new SolarSystemRenderer(
  requireElement("scene"),
  requireElement("labels"),
  simulation.bodies,
  orbitalDefinitions,
  belts,
  initialSun.massKg,
);

const toggleButton = requireElement<HTMLButtonElement>("toggle");
const resetButton = requireElement<HTMLButtonElement>("reset");
const fitButton = requireElement<HTMLButtonElement>("fit");
const fitInnerButton = requireElement<HTMLButtonElement>("fit-inner");
const stopFollowButton = requireElement<HTMLButtonElement>("stop-follow");
const speedInput = requireElement<HTMLInputElement>("speed");
const speedValue = requireElement<HTMLOutputElement>("speed-value");
const trailsInput = requireElement<HTMLInputElement>("trails");
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
const energyDriftElement = requireElement("energy-drift");
const momentumDriftElement = requireElement("momentum-drift");
const stepsFrameElement = requireElement("steps-frame");
const selectedBodyElement = requireElement("selected-body");

const namesById = new Map<string, string>([
  ...initialBodies.map((body) => [body.id, body.name] as const),
  ...orbitalDefinitions.map((body) => [body.id, body.name] as const),
]);
const navigatorEntries: readonly NavigatorEntry[] = [
  ...initialBodies.map((body) => ({
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

let running = true;
let accumulatorSeconds = 0;
let lastFrameTime = performance.now();
let timeScale = TIME_SCALES[Number(speedInput.value)] ?? TIME_SCALES[3];
let initialConserved = calculateConservedQuantities(simulation.bodies);
let lastDiagnosticsElapsed = Number.NEGATIVE_INFINITY;
let orbitalStates: readonly HierarchicalBodyState[] = calculateOrbitalStates(0);
let selectedBodyId = "sun";
let filteredNavigatorEntries: NavigatorEntry[] = [];
let activeNavigatorIndex = 0;

function calculateOrbitalStates(elapsedSeconds: number): HierarchicalBodyState[] {
  return propagateHierarchicalBodies(
    orbitalDefinitions,
    simulation.bodies,
    J2000_JULIAN_DAY + elapsedSeconds / DAY_SECONDS,
  );
}

function parentMassKg(parentId: string): number {
  return (
    simulation.bodies.find((body) => body.id === parentId)?.massKg ??
    orbitalDefinitions.find((body) => body.id === parentId)?.massKg ??
    0
  );
}

function formatPeriod(seconds: number): string {
  const days = seconds / DAY_SECONDS;
  return days >= 730 ? `${(days / 365.25).toFixed(2)} years` : `${days.toFixed(2)} days`;
}

function updateSelectedBody(id: string): void {
  selectedBodyId = id;
  const body = simulation.bodies.find((candidate) => candidate.id === id);
  if (body) {
    const facts = MASSIVE_BODY_FACTS[id];
    const sun = simulation.bodies.find((candidate) => candidate.id === "sun");
    let orbitalText = "System center";
    if (body.id !== "sun" && sun) {
      const elements = stateToOsculatingElements(
        subtract(body.positionM, sun.positionM),
        subtract(body.velocityMps, sun.velocityMps),
        sun.massKg + body.massKg,
        J2000_JULIAN_DAY,
      );
      const period = 2 * Math.PI * Math.sqrt(
        elements.semiMajorAxisM ** 3 /
          (GRAVITATIONAL_CONSTANT * (sun.massKg + body.massKg)),
      );
      orbitalText = `Sun distance: ${(magnitude(subtract(body.positionM, sun.positionM)) / ASTRONOMICAL_UNIT_M).toFixed(3)} AU<br>Orbital period: ${formatPeriod(period)}`;
    }
    selectedBodyElement.innerHTML = `
      <strong>${body.name}</strong>
      <span>
        ${body.category}<br>
        Parent: ${body.id === "sun" ? "None" : "Sun"}<br>
        Radius: ${(body.radiusM / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km<br>
        Surface gravity: ${facts?.surfaceGravityMps2?.toFixed(3) ?? "Unknown"} m/s²<br>
        ${orbitalText}<br>
        Live speed: ${(magnitude(body.velocityMps) / 1_000).toFixed(2)} km/s<br>
        Discovery: ${facts?.discovery ?? "Unknown"}<br><br>
        ${facts?.significance ?? ""}
      </span>
    `;
    return;
  }

  const state = orbitalStates.find((candidate) => candidate.body.id === id);
  if (!state) return;
  const definition = state.body;
  const period = 2 * Math.PI * Math.sqrt(
    definition.elements.semiMajorAxisM ** 3 /
      (GRAVITATIONAL_CONSTANT * (parentMassKg(definition.parentId) + definition.massKg)),
  );
  const gravity =
    definition.facts.surfaceGravityMps2 ??
    (GRAVITATIONAL_CONSTANT * definition.massKg) / definition.radiusM ** 2;
  const distance = magnitude(state.relativePositionM);
  const distanceText =
    definition.category === "moon"
      ? `${(distance / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km`
      : `${(distance / ASTRONOMICAL_UNIT_M).toFixed(3)} AU`;
  selectedBodyElement.innerHTML = `
    <strong>${definition.name}</strong>
    <span>
      ${definition.category} | massless simulation body<br>
      Parent: ${namesById.get(definition.parentId) ?? definition.parentId}<br>
      Radius: ${(definition.radiusM / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km<br>
      Surface gravity: ${gravity.toFixed(4)} m/s²<br>
      Parent distance: ${distanceText}<br>
      Orbital period: ${formatPeriod(period)}<br>
      Live relative speed: ${(magnitude(state.relativeVelocityMps) / 1_000).toFixed(2)} km/s<br>
      Discovery: ${definition.facts.discovery}<br><br>
      ${definition.facts.significance}
    </span>
  `;
}

function selectAndFollow(id: string): void {
  renderer.selectBody(id);
  renderer.focusBody(id, true);
  updateSelectedBody(id);
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
  searchInput.setAttribute(
    "aria-expanded",
    String(filteredNavigatorEntries.length > 0),
  );
  searchResults.querySelector<HTMLElement>(".navigator-result.active")?.scrollIntoView({
    block: "nearest",
  });
}

function updateRunningUi(): void {
  toggleButton.textContent = running ? "Pause" : "Resume";
  statusElement.textContent = running ? "Running" : "Paused";
  statusElement.classList.toggle("paused", !running);
}

function reset(): void {
  simulation.reset();
  accumulatorSeconds = 0;
  orbitalStates = calculateOrbitalStates(0);
  initialConserved = calculateConservedQuantities(simulation.bodies);
  lastDiagnosticsElapsed = Number.NEGATIVE_INFINITY;
  renderer.clearTrails();
  renderer.update(simulation.bodies, orbitalStates, simulation.elapsedSeconds);
  renderer.selectBody("sun");
  renderer.stopFollowing();
  updateSelectedBody("sun");
  renderNavigator();
}

function updateTelemetry(stepsThisFrame: number): void {
  const elapsed = simulation.elapsedSeconds;
  const currentDate = new Date(new Date(J2000_ISO).getTime() + elapsed * 1_000);
  dateElement.textContent = currentDate.toISOString().slice(0, 10);
  elapsedElement.textContent = `${(elapsed / DAY_SECONDS).toFixed(2)} days`;
  stepsFrameElement.textContent = String(stepsThisFrame);
  if (elapsed - lastDiagnosticsElapsed >= 30 * DAY_SECONDS || elapsed === 0) {
    const current = calculateConservedQuantities(simulation.bodies);
    energyDriftElement.textContent =
      `${(relativeDrift(current.energyJ, initialConserved.energyJ) * 1e6).toFixed(3)} ppm`;
    momentumDriftElement.textContent = `${(
      relativeDrift(
        magnitude(current.angularMomentumKgM2ps),
        magnitude(initialConserved.angularMomentumKgM2ps),
      ) * 1e6
    ).toFixed(3)} ppm`;
    lastDiagnosticsElapsed = elapsed;
  }
}

toggleButton.addEventListener("click", () => {
  running = !running;
  updateRunningUi();
});
resetButton.addEventListener("click", reset);
fitButton.addEventListener("click", () => {
  renderer.stopFollowing();
  renderer.fitSystem();
});
fitInnerButton.addEventListener("click", () => {
  renderer.stopFollowing();
  renderer.fitInnerSystem();
});
stopFollowButton.addEventListener("click", () => renderer.stopFollowing());
speedInput.addEventListener("input", () => {
  timeScale = TIME_SCALES[Number(speedInput.value)] ?? TIME_SCALES[3];
  speedValue.value = timeScale.label;
});
trailsInput.addEventListener("change", () => renderer.setTrailsVisible(trailsInput.checked));
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
renderer.onBodySelected(selectAndFollow);
renderer.onFollowChanged((id) => {
  stopFollowButton.hidden = id === undefined;
  stopFollowButton.textContent = id ? `Stop Following ${namesById.get(id) ?? ""}` : "Stop Following";
});

function frame(now: number): void {
  const realDeltaSeconds = Math.min((now - lastFrameTime) / 1_000, 0.1);
  lastFrameTime = now;
  let stepsThisFrame = 0;
  if (running) {
    accumulatorSeconds += realDeltaSeconds * timeScale.seconds;
    while (
      accumulatorSeconds >= simulation.fixedTimestepSeconds &&
      stepsThisFrame < MAX_STEPS_PER_FRAME
    ) {
      simulation.step();
      accumulatorSeconds -= simulation.fixedTimestepSeconds;
      stepsThisFrame += 1;
    }
    if (stepsThisFrame === MAX_STEPS_PER_FRAME) {
      accumulatorSeconds = Math.min(accumulatorSeconds, simulation.fixedTimestepSeconds);
    }
  }
  orbitalStates = calculateOrbitalStates(simulation.elapsedSeconds);
  renderer.update(simulation.bodies, orbitalStates, simulation.elapsedSeconds);
  renderer.render();
  updateTelemetry(stepsThisFrame);
  if (selectedBodyId !== "sun") updateSelectedBody(selectedBodyId);
  requestAnimationFrame(frame);
}

renderer.selectBody("sun");
renderer.update(simulation.bodies, orbitalStates, 0);
updateSelectedBody("sun");
updateRunningUi();
renderNavigator();
requestAnimationFrame(frame);
