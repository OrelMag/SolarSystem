# Solar System Simulation Agent Guide

## Project Goal

Build an interactive, browser-based simulation of the Solar System using
TypeScript and Three.js. The first release presents a 2D top-down view of the
Sun and the eight recognized planets:

- Mercury
- Venus
- Earth
- Mars
- Jupiter
- Saturn
- Uranus
- Neptune

The simulation must use Newtonian N-body gravity and real astronomical
parameters. Design every subsystem so moons, dwarf planets, asteroids, comets,
spacecraft, and additional star systems can be added without rewriting the
physics engine.

Correct simulation state is more important than visual spectacle. Rendering
must communicate the physics clearly without changing it.

## Core Engineering Principles

- Keep the code modular, typed, testable, and independently replaceable.
- Keep domain and physics code free of Three.js and browser dependencies.
- Treat simulation state as the single source of truth.
- Never read physical position, velocity, mass, or time from a Three.js object.
- Convert physical state into render state through a dedicated adapter.
- Use SI units internally: kilograms, metres, seconds, and radians.
- Name non-SI or scaled values explicitly and convert them at system boundaries.
- Use immutable, stable identifiers for celestial bodies.
- Prefer data-driven body definitions over body-specific conditionals.
- Inject configuration and dependencies instead of relying on mutable globals.
- Keep each module focused on one responsibility and expose a small public API.
- Avoid premature abstractions, but do not couple physics to presentation.

## Technology Baseline

- TypeScript in strict mode
- Three.js for visualization
- An orthographic camera configured as a 2D top-down view
- A modern browser build tool such as Vite
- A TypeScript-compatible unit-test runner such as Vitest
- ESLint and Prettier, or the repository's established equivalents

Do not add a large application framework unless a concrete requirement
justifies it.

## Architecture

Organize the application around these conceptual modules:

### Domain Model

Define plain TypeScript types for celestial bodies and simulation state. A body
must include, at minimum:

- Stable identifier
- Display name and body category
- Mass in kilograms
- Physical radius in metres
- Position in metres
- Velocity in metres per second
- Optional visual metadata that does not affect physics

Vector values must use a shared, physics-owned vector type or a small
math-library type. Do not expose `THREE.Vector3` to domain or physics modules.
Although the initial view is 2D, prefer a three-component physical vector model
when it does not add significant complexity so spatial simulation can be added
later.

### Physics Engine

The physics engine owns:

- Pairwise Newtonian gravitational acceleration
- N-body state advancement
- Fixed simulation timesteps
- Collision and near-zero-distance safeguards
- Conserved-quantity calculations for diagnostics

Use:

`F = G * m1 * m2 / r^2`

with the accepted gravitational constant represented in SI units. Compute
mutual interactions symmetrically so each pair is evaluated once where
practical.

Use a fixed-timestep velocity-Verlet or leapfrog integrator. Do not use a simple
variable-step Euler integrator for orbital simulation. Rendering may run at a
variable frame rate, but elapsed real time must be accumulated and consumed in
fixed physics steps. Limit work per frame to prevent an unbounded catch-up
loop.

Make the following configurable:

- Physics timestep in simulated seconds
- Simulated-time-to-real-time scale
- Maximum physics steps per rendered frame
- Collision or minimum-distance policy

Do not silently soften gravity or merge bodies. Any softening, collision,
merging, or minimum-distance behavior must be explicit, documented, and tested.

### Astronomical Data

Store initial body definitions separately from code that simulates them.
Initial masses, radii, positions, and velocities must come from authoritative
sources such as NASA/JPL datasets or published ephemerides.

Record with each dataset:

- Source and source URL or identifier
- Epoch of the state vectors
- Reference frame
- Units supplied by the source
- Conversion applied before simulation

Convert imported data to SI units at the data-loading boundary. Do not scatter
conversion constants throughout the physics engine. Approximate circular-orbit
fixtures are acceptable only in tests or clearly labeled demo datasets.

### Rendering

Rendering consumes read-only snapshots or interpolated views of simulation
state. It must not mutate the physics state.

Use separate configurable transformations for:

- Physical distance to scene distance
- Physical radius to visible radius
- Camera zoom

Planet radii may require an exaggerated visual scale to remain visible. Clearly
distinguish this from orbital distance scale and never feed either scale back
into physics.

The first release must provide:

- Orthographic top-down camera
- Pan and zoom controls
- Visible Sun and all eight planets
- Body labels
- Configurable orbital trails
- Pause and resume
- Simulation-speed controls
- Current simulation date or elapsed simulated time
- A diagnostic overlay

Trails must use bounded storage, such as a ring buffer or capped sample list.
Avoid allocating new objects every frame in hot rendering paths.

### Controls and Application Orchestration

The application layer wires together data, simulation, controls, diagnostics,
and rendering. It may depend on all those interfaces, but those modules must not
depend on the application entry point.

Controls issue commands such as pause, resume, change speed, reset, select a
body, pan, and zoom. They must not directly edit body state.

Reset must restore a clean copy of the selected initial dataset and reset
simulation time, trails, diagnostics, and accumulated frame time.

### Diagnostics

Expose diagnostics without coupling them to the visual layer. At minimum,
support:

- Physics steps per frame
- Simulated timestep and time scale
- Total system energy
- Total linear momentum
- Total angular momentum
- Drift from initial energy and angular momentum

Diagnostics should make numerical instability visible. Expensive diagnostics
may run less frequently than the physics loop.

## Dependency Direction

Dependencies must flow toward stable, presentation-independent code:

1. Math and domain types depend on nothing application-specific.
2. Physics depends only on math, domain types, and explicit configuration.
3. Data loading depends on domain types and unit-conversion utilities.
4. Rendering depends on Three.js plus read-only domain views or render DTOs.
5. Controls depend on application command interfaces.
6. Application orchestration composes all modules.

Physics, domain, and astronomical-data modules must never import Three.js,
DOM APIs, UI components, or the application entry point.

## TypeScript Standards

- Enable strict compiler checks.
- Avoid `any`; use `unknown` plus validation for external data.
- Use `readonly` for identifiers, configuration, and snapshots where possible.
- Represent units in names or branded types when values could be confused.
- Prefer pure functions for force, acceleration, energy, momentum, and
  conversion calculations.
- Validate external datasets before constructing simulation state.
- Use exhaustive handling for body categories and command variants.
- Return structured errors or results for recoverable failures.
- Keep public APIs documented, especially their units and mutation behavior.
- Do not optimize without evidence, but avoid per-body allocations inside the
  inner N-body loop.

## Numerical and Behavioral Requirements

- The simulation clock advances only through completed fixed physics steps.
- Pausing stops physics advancement without resetting state.
- Changing display scale or camera state cannot alter an orbit.
- Changing simulation speed changes the number or cadence of fixed steps, not
  the mathematical meaning of one step.
- Frame interpolation may smooth rendering but cannot become simulation state.
- Body ordering must not change physical results beyond expected floating-point
  variation.
- Invalid masses, non-finite vectors, duplicate identifiers, and invalid
  timesteps must fail early with useful errors.
- Collision behavior must avoid division by zero and non-finite state.

## Testing Requirements

Keep physics tests independent of Three.js, the DOM, and wall-clock timing.

### Unit Tests

Test:

- Vector and unit conversions
- Newtonian force and acceleration magnitude and direction
- Equal-and-opposite pairwise interaction
- Integrator updates for known states
- Pause, reset, and time-scale behavior
- Invalid input handling
- Collision or minimum-distance safeguards
- Energy, linear momentum, and angular momentum calculations

### Physics Validation

Include deterministic scenarios for:

- A stationary or symmetric two-body interaction
- A near-circular two-body orbit
- A multi-body state with a known center of mass
- Forward simulation over many orbital periods

Assert bounded, documented tolerances for energy and angular-momentum drift.
Choose tolerances from measured behavior at the configured timestep rather than
using arbitrary broad thresholds. Conservation tests should compare against the
initial state and report useful values when they fail.

### Rendering and Integration Tests

- Test the physics-to-render coordinate mapping without a live WebGL context.
- Test that visual radius and distance scaling are independent.
- Test render-object creation, update, selection, and disposal through adapters.
- Test bounded trail retention.
- Add a small application smoke test covering load, start, pause, speed change,
  reset, and resume.

## Performance and Scalability

The direct N-body implementation may begin with `O(n^2)` pairwise gravity,
which is appropriate for the initial Solar System. Keep the force-calculation
interface replaceable so Barnes-Hut or another approximation can be added for
large asteroid populations.

Measure before optimizing. When optimization is needed, prioritize:

- Avoiding allocations in physics loops
- Reusing vector and render objects
- Bounded trail and diagnostic histories
- Separating diagnostic frequency from physics frequency
- Profiling physics and rendering independently

Do not trade numerical correctness for frame rate without making the chosen
approximation explicit and configurable.

## Delivery Milestones

1. **Foundation:** Configure strict TypeScript, tests, linting, and module
   boundaries. Implement vectors, units, body types, and validated datasets.
2. **Physics Core:** Implement N-body acceleration, the fixed-step integrator,
   simulation clock, conserved quantities, and deterministic tests.
3. **Solar Dataset:** Add the Sun and eight planets with sourced state vectors,
   epoch metadata, reference-frame documentation, and SI conversion.
4. **Visualization:** Render the physical state through an orthographic Three.js
   scene with independent distance and radius scaling.
5. **Interaction:** Add pan, zoom, selection, labels, trails, pause, reset, and
   simulation-speed controls.
6. **Validation:** Add diagnostics, long-running conservation tests, browser
   smoke tests, and performance measurements.
7. **Extension:** Add moons or minor bodies through data and existing extension
   points, using this as proof that the architecture remains modular.

Each milestone must leave the test suite passing and must not bypass module
boundaries to accelerate later work.

## Definition of Done for the First Release

The first release is complete when:

- The Sun and all eight planets load from a documented astronomical dataset.
- Their state advances through mutual Newtonian gravity using a fixed timestep.
- The simulation remains finite and stable for the documented validation
  duration and timestep.
- Energy and angular-momentum drift are measured and remain within documented
  tolerances.
- The 2D Three.js view supports pan, zoom, labels, trails, pause, reset, and
  speed controls.
- Visual scaling and camera changes do not affect physics.
- Physics and data modules have no Three.js or DOM dependencies.
- Unit, validation, rendering-adapter, and smoke tests pass.

## Explicit Non-Goals for the Initial Release

- General relativity and relativistic orbital corrections
- High-precision reproduction of JPL ephemerides over long time spans
- Atmospheric, tidal, thermal, or geological simulation
- Body deformation or fluid dynamics
- Photorealistic scale relationships
- Multiplayer or server-authoritative simulation

These capabilities may be added later through new models and adapters without
weakening the initial architecture.
