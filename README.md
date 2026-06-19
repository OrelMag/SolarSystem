# Solar System Simulation

An interactive 2D Newtonian N-body simulation of the Sun and eight planets,
built with TypeScript and Three.js.

The view also includes live osculating orbit paths, dynamically propagated
asteroid and Kuiper belts, and four selectable comets.

Planetary-neighborhood exploration adds physical Pluto and 12 major moons, a
searchable body navigator, zoom-aware local moon systems, and camera follow mode.

## Run

```sh
npm install
npm run dev
```

Then open the local URL printed by Vite.

On Windows, you can also launch the simulation with:

```sh
.\SolarSystem.exe
```

The launcher starts the Vite server on `http://127.0.0.1:5173/`, opens the
browser, and stops the server when its console window is closed. Rebuild it with
`npm run build:launcher` after changing `tools/SolarSystemLauncher.cs`.

## Verify

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Or run the complete local release check:

```sh
npm run test:all
```

## Model

- SI units throughout the domain and physics layers
- Symmetric pairwise Newtonian gravity
- Fixed five-minute velocity-Verlet integration step
- Selectable JPL approximate-element and Horizons Cartesian datasets
- Barycentric correction for the approximate dataset's initial Sun state
- Independent physical distance, visible body radius, and camera scales
- Explicit minimum-distance collision policy with structured simulation errors
- Live planet paths recovered from current N-body state vectors
- 6,000 deterministic, massless Keplerian belt particles
- JPL orbital elements for Halley, Hale-Bopp, Encke, and 67P
- Distance-responsive anti-solar comet tails
- Physical N-body integration for Pluto and 12 major moons
- Hierarchical parent-relative propagation for display-only comets
- Structured discovery, gravity, orbital, and significance facts

The initial orbital elements come from the
[NASA/JPL approximate planetary positions dataset](https://ssd.jpl.nasa.gov/planets/approx_pos.html).
The Horizons Planets scenario uses a checked-in Cartesian state-vector snapshot
queried from the [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
for J2000.0 TDB, centered on the Solar System barycenter in the ecliptic of
J2000.0 reference frame. Horizons positions are stored from source kilometres
and velocities from kilometres per second, then converted to SI units at load
time.

The simulation is educational: it models mutual Newtonian gravity for the Sun,
eight planets, Pluto, and 12 major moons, but does not include relativistic
corrections or high-precision ephemeris terms. Belts and comets are massless
test particles, so they do not affect trajectories or conservation diagnostics.

## Validation

The deterministic conservation fixture runs a circular two-body system with a
one-hour fixed timestep for 1, 10, and 100 simulated years. The documented
tolerances are:

- Energy drift: at most `1e-8`
- Angular-momentum drift: at most `1e-12`

The browser smoke suite starts Vite with Playwright/Chromium and covers load,
nonblank canvas capture, pause/resume, speed change, reset, search/selection,
and mobile collapsed controls.

## Controls

- Drag to pan and use the mouse wheel to zoom.
- Click a planet or comet to inspect and focus it.
- Search and keyboard-navigate all planets, Pluto, moons, and comets.
- Follow a selected body as it moves; pan manually or use Stop Following to exit.
- Pause, resume, reset, or change the simulated time rate from the side panel.
- Toggle historical trails, live planet paths, either belt, comet paths, comet
  tails, and labels independently.
- Switch between inner-system and full Kuiper-belt framing.
- Toggle major moons; local moon systems appear automatically when zoomed in or
  when their parent system is selected.
- Expand all displayed distances up to 8x for readability without changing any
  physical state or orbital calculation. Both framing controls account for the
  selected scale.
- Toggle the center-of-mass marker to see the current barycenter in the active
  view frame.

Distance scaling, body marker scaling, camera pan, and zoom are visual
transforms only. They never feed back into body position, velocity, mass, time,
or the gravity calculation.

## Release Checklist

- Sun and eight planets load from a documented astronomical dataset.
- Physics advances through fixed-timestep velocity-Verlet N-body gravity.
- Energy and angular-momentum drift are measured against documented tolerances.
- Physics/data modules remain free of rendering, UI, app, Three.js, and DOM
  dependencies.
- Pan, zoom, labels, trails, pause/resume, reset, speed controls, diagnostics,
  optional center-of-mass marker, and mobile controls work in browser smoke tests.
- `npm run test:all` passes before tagging or shipping.

See [AGENTS.md](./AGENTS.md) for architecture, extension, and validation rules.
