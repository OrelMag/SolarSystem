import "./style.css";
import { createSolarSystem } from "./data/solarSystem";
import { magnitude } from "./domain/vector";
import {
  calculateConservedQuantities,
  relativeDrift,
} from "./physics/diagnostics";
import { ASTRONOMICAL_UNIT_M, DAY_SECONDS, J2000_ISO } from "./physics/constants";
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
const simulation = new NBodySimulation(initialBodies, {
  fixedTimestepSeconds: FIXED_TIMESTEP_SECONDS,
  minimumDistanceM: 1_000,
});
const renderer = new SolarSystemRenderer(
  requireElement("scene"),
  requireElement("labels"),
  simulation.bodies,
);

const toggleButton = requireElement<HTMLButtonElement>("toggle");
const resetButton = requireElement<HTMLButtonElement>("reset");
const fitButton = requireElement<HTMLButtonElement>("fit");
const speedInput = requireElement<HTMLInputElement>("speed");
const speedValue = requireElement<HTMLOutputElement>("speed-value");
const trailsInput = requireElement<HTMLInputElement>("trails");
const labelsInput = requireElement<HTMLInputElement>("labels-toggle");
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

function updateSelectedBody(id: string): void {
  const body = simulation.bodies.find((candidate) => candidate.id === id);
  if (!body) return;
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
}

function updateRunningUi(): void {
  toggleButton.textContent = running ? "Pause" : "Resume";
  statusElement.textContent = running ? "Running" : "Paused";
  statusElement.classList.toggle("paused", !running);
}

function reset(): void {
  simulation.reset();
  accumulatorSeconds = 0;
  initialConserved = calculateConservedQuantities(simulation.bodies);
  lastDiagnosticsElapsed = Number.NEGATIVE_INFINITY;
  renderer.clearTrails();
  renderer.update(simulation.bodies, simulation.elapsedSeconds);
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
speedInput.addEventListener("input", () => {
  timeScale = TIME_SCALES[Number(speedInput.value)] ?? TIME_SCALES[3];
  speedValue.value = timeScale.label;
});
trailsInput.addEventListener("change", () => renderer.setTrailsVisible(trailsInput.checked));
labelsInput.addEventListener("change", () => renderer.setLabelsVisible(labelsInput.checked));
renderer.onBodySelected((id) => updateSelectedBody(id));

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

  renderer.update(simulation.bodies, simulation.elapsedSeconds);
  renderer.render();
  updateTelemetry(stepsThisFrame);
  requestAnimationFrame(frame);
}

renderer.selectBody("sun");
renderer.update(simulation.bodies, 0);
updateSelectedBody("sun");
updateRunningUi();
requestAnimationFrame(frame);
