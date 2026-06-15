import "./style.css";
import { BELT_DEFINITIONS, generateBeltParticles } from "./data/belts";
import { COMETS } from "./data/comets";
import { createSolarSystem } from "./data/solarSystem";
import type { MasslessBodyState } from "./domain/orbits";
import { magnitude } from "./domain/vector";
import {
  calculateConservedQuantities,
  relativeDrift,
} from "./physics/diagnostics";
import { ASTRONOMICAL_UNIT_M, DAY_SECONDS, J2000_ISO } from "./physics/constants";
import {
  J2000_JULIAN_DAY,
  propagateEllipticOrbit,
} from "./physics/orbitalMechanics";
import { NBodySimulation } from "./physics/simulation";
import { SolarSystemRenderer } from "./rendering/SolarSystemRenderer";

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

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing element "#${id}".`);
  return element as T;
}

const initialBodies = createSolarSystem();
const initialSun = initialBodies.find((body) => body.id === "sun");
if (!initialSun) throw new Error("Solar dataset must include the Sun.");
const sunMassKg = initialSun.massKg;
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
  COMETS,
  belts,
  sunMassKg,
);

const toggleButton = requireElement<HTMLButtonElement>("toggle");
const resetButton = requireElement<HTMLButtonElement>("reset");
const fitButton = requireElement<HTMLButtonElement>("fit");
const fitInnerButton = requireElement<HTMLButtonElement>("fit-inner");
const speedInput = requireElement<HTMLInputElement>("speed");
const speedValue = requireElement<HTMLOutputElement>("speed-value");
const trailsInput = requireElement<HTMLInputElement>("trails");
const planetPathsInput = requireElement<HTMLInputElement>("planet-paths");
const mainBeltInput = requireElement<HTMLInputElement>("main-belt");
const kuiperBeltInput = requireElement<HTMLInputElement>("kuiper-belt");
const cometPathsInput = requireElement<HTMLInputElement>("comet-paths");
const cometTailsInput = requireElement<HTMLInputElement>("comet-tails");
const labelsInput = requireElement<HTMLInputElement>("labels-toggle");
const distanceScaleInput = requireElement<HTMLInputElement>("distance-scale");
const distanceScaleValue = requireElement<HTMLOutputElement>("distance-scale-value");
const statusElement = requireElement("status");
const dateElement = requireElement("date");
const elapsedElement = requireElement("elapsed");
const energyDriftElement = requireElement("energy-drift");
const momentumDriftElement = requireElement("momentum-drift");
const stepsFrameElement = requireElement("steps-frame");
const selectedBodyElement = requireElement("selected-body");

let running = true;
let accumulatorSeconds = 0;
let lastFrameTime = performance.now();
let timeScale = TIME_SCALES[Number(speedInput.value)] ?? TIME_SCALES[3];
let initialConserved = calculateConservedQuantities(simulation.bodies);
let lastDiagnosticsElapsed = Number.NEGATIVE_INFINITY;
let cometStates: readonly MasslessBodyState[] = calculateCometStates(0);

function calculateCometStates(elapsedSeconds: number): MasslessBodyState[] {
  const julianDay = J2000_JULIAN_DAY + elapsedSeconds / DAY_SECONDS;
  return COMETS.map((body) => {
    const state = propagateEllipticOrbit(body.elements, julianDay, sunMassKg);
    return { body, ...state };
  });
}

function updateSelectedBody(id: string): void {
  const body = simulation.bodies.find((candidate) => candidate.id === id);
  if (body) {
    const speedKps = magnitude(body.velocityMps) / 1_000;
    const distanceAu = magnitude(body.positionM) / ASTRONOMICAL_UNIT_M;
    selectedBodyElement.innerHTML = `
      <strong>${body.name}</strong>
      <span>
        ${body.category}<br>
        Mass: ${body.massKg.toExponential(3)} kg<br>
        Radius: ${(body.radiusM / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km<br>
        Barycentric distance: ${distanceAu.toFixed(3)} AU<br>
        Speed: ${speedKps.toFixed(2)} km/s
      </span>
    `;
    return;
  }
  const comet = cometStates.find((candidate) => candidate.body.id === id);
  if (!comet) return;
  const distanceAu = magnitude(comet.positionM) / ASTRONOMICAL_UNIT_M;
  const speedKps = magnitude(comet.velocityMps) / 1_000;
  const semiMajorAxisAu = comet.body.elements.semiMajorAxisM / ASTRONOMICAL_UNIT_M;
  const perihelionAu = semiMajorAxisAu * (1 - comet.body.elements.eccentricity);
  const aphelionAu = semiMajorAxisAu * (1 + comet.body.elements.eccentricity);
  selectedBodyElement.innerHTML = `
    <strong>${comet.body.name}</strong>
    <span>
      comet | massless test particle<br>
      Heliocentric distance: ${distanceAu.toFixed(3)} AU<br>
      Speed: ${speedKps.toFixed(2)} km/s<br>
      Perihelion / aphelion: ${perihelionAu.toFixed(3)} / ${aphelionAu.toFixed(1)} AU<br>
      Source: NASA/JPL SBDB
    </span>
  `;
}

function updateRunningUi(): void {
  toggleButton.textContent = running ? "Pause" : "Resume";
  statusElement.textContent = running ? "Running" : "Paused";
  statusElement.classList.toggle("paused", !running);
}

function reset(): void {
  simulation.reset();
  accumulatorSeconds = 0;
  cometStates = calculateCometStates(0);
  initialConserved = calculateConservedQuantities(simulation.bodies);
  lastDiagnosticsElapsed = Number.NEGATIVE_INFINITY;
  renderer.clearTrails();
  renderer.update(simulation.bodies, cometStates, simulation.elapsedSeconds);
  renderer.selectBody("sun");
  updateSelectedBody("sun");
}

function updateTelemetry(stepsThisFrame: number): void {
  const elapsed = simulation.elapsedSeconds;
  const currentDate = new Date(new Date(J2000_ISO).getTime() + elapsed * 1_000);
  dateElement.textContent = currentDate.toISOString().slice(0, 10);
  elapsedElement.textContent = `${(elapsed / DAY_SECONDS).toFixed(2)} days`;
  stepsFrameElement.textContent = String(stepsThisFrame);
  if (elapsed - lastDiagnosticsElapsed >= 30 * DAY_SECONDS || elapsed === 0) {
    const current = calculateConservedQuantities(simulation.bodies);
    const energyPpm = relativeDrift(current.energyJ, initialConserved.energyJ) * 1e6;
    const initialAngular = magnitude(initialConserved.angularMomentumKgM2ps);
    const currentAngular = magnitude(current.angularMomentumKgM2ps);
    const angularPpm = relativeDrift(currentAngular, initialAngular) * 1e6;
    energyDriftElement.textContent = `${energyPpm.toFixed(3)} ppm`;
    momentumDriftElement.textContent = `${angularPpm.toFixed(3)} ppm`;
    lastDiagnosticsElapsed = elapsed;
  }
}

toggleButton.addEventListener("click", () => {
  running = !running;
  updateRunningUi();
});
resetButton.addEventListener("click", reset);
fitButton.addEventListener("click", () => renderer.fitSystem());
fitInnerButton.addEventListener("click", () => renderer.fitInnerSystem());
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
labelsInput.addEventListener("change", () => renderer.setLabelsVisible(labelsInput.checked));
distanceScaleInput.addEventListener("input", () => {
  const scale = Number(distanceScaleInput.value);
  renderer.setInnerDistanceScale(scale);
  distanceScaleValue.value = scale === 1 ? "1x physical" : `${scale}x inner`;
});
renderer.onBodySelected((id) => {
  updateSelectedBody(id);
  renderer.focusBody(id);
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
  cometStates = calculateCometStates(simulation.elapsedSeconds);
  renderer.update(simulation.bodies, cometStates, simulation.elapsedSeconds);
  renderer.render();
  updateTelemetry(stepsThisFrame);
  requestAnimationFrame(frame);
}

renderer.selectBody("sun");
renderer.update(simulation.bodies, cometStates, 0);
updateSelectedBody("sun");
updateRunningUi();
requestAnimationFrame(frame);
