# Solar System Simulation

An interactive 2D Newtonian N-body simulation of the Sun and eight planets,
built with TypeScript and Three.js.

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

The initial orbital elements come from the
[NASA/JPL approximate planetary positions dataset](https://ssd.jpl.nasa.gov/planets/approx_pos.html).
The simulation is educational: it models mutual Newtonian gravity but does not
include relativistic corrections, moons, or high-precision ephemeris terms.

## Controls

- Drag to pan and use the mouse wheel to zoom.
- Click a body to inspect its current state.
- Pause, resume, reset, or change the simulated time rate from the side panel.
- Toggle labels and bounded orbital trails.

See [AGENTS.md](./AGENTS.md) for architecture, extension, and validation rules.
