# Solar System Simulation

An interactive 2D Newtonian N-body simulation of the Sun and eight planets,
built with TypeScript and Three.js.

The view also includes live osculating orbit paths, dynamically propagated
asteroid and Kuiper belts, and four selectable comets.

Planetary-neighborhood exploration adds Pluto, 12 major moons, a searchable
body navigator, zoom-aware local moon systems, and camera follow mode.

## Run

```sh
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

## Model

- SI units throughout the domain and physics layers
- Symmetric pairwise Newtonian gravity
- Fixed three-hour velocity-Verlet integration step
- J2000 planetary elements converted to Cartesian state vectors
- Barycentric correction for the Sun's initial position and velocity
- Independent physical distance, visible body radius, and camera scales
- Live planet paths recovered from current N-body state vectors
- 6,000 deterministic, massless Keplerian belt particles
- JPL orbital elements for Halley, Hale-Bopp, Encke, and 67P
- Distance-responsive anti-solar comet tails
- Hierarchical parent-relative propagation for Pluto and major moons
- Structured discovery, gravity, orbital, and significance facts

The initial orbital elements come from the
[NASA/JPL approximate planetary positions dataset](https://ssd.jpl.nasa.gov/planets/approx_pos.html).
The simulation is educational: it models mutual Newtonian gravity but does not
include relativistic corrections, moons, or high-precision ephemeris terms.
Belts and comets are massless test particles, so they do not affect planetary
trajectories or conservation diagnostics.
Pluto and moons use the same massless hierarchy and two-body approximation.

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

See [AGENTS.md](./AGENTS.md) for architecture, extension, and validation rules.
