import type { CelestialBody } from "../domain/types";
import { add, scale, vector } from "../domain/vector";
import { orbitalElementsToState, type OrbitalElements } from "./orbitalElements";

export const SOLAR_DATASET_METADATA = {
  epoch: "J2000.0 (2000-01-01T12:00:00Z)",
  referenceFrame: "Mean ecliptic and equinox of J2000.0",
  source: "NASA/JPL Solar System Dynamics, approximate positions of the planets",
  sourceUrl: "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
  notes: "J2000 base elements converted from AU/degrees to SI Cartesian state.",
} as const;

const SUN = {
  massKg: 1.988_47e30,
  radiusM: 696_340_000,
};

interface PlanetDefinition {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  readonly radiusM: number;
  readonly color: number;
  readonly elements: OrbitalElements;
}

const PLANETS: readonly PlanetDefinition[] = [
  {
    id: "mercury",
    name: "Mercury",
    massKg: 3.3011e23,
    radiusM: 2_439_700,
    color: 0xa6a09a,
    elements: {
      semiMajorAxisAu: 0.38709927,
      eccentricity: 0.20563593,
      inclinationDeg: 7.00497902,
      meanLongitudeDeg: 252.2503235,
      longitudePerihelionDeg: 77.45779628,
      longitudeAscendingNodeDeg: 48.33076593,
    },
  },
  {
    id: "venus",
    name: "Venus",
    massKg: 4.8675e24,
    radiusM: 6_051_800,
    color: 0xd6ad68,
    elements: {
      semiMajorAxisAu: 0.72333566,
      eccentricity: 0.00677672,
      inclinationDeg: 3.39467605,
      meanLongitudeDeg: 181.9790995,
      longitudePerihelionDeg: 131.6024672,
      longitudeAscendingNodeDeg: 76.67984337,
    },
  },
  {
    id: "earth",
    name: "Earth",
    massKg: 5.972_19e24,
    radiusM: 6_371_000,
    color: 0x4c86d9,
    elements: {
      semiMajorAxisAu: 1.00000261,
      eccentricity: 0.01671123,
      inclinationDeg: -0.00001531,
      meanLongitudeDeg: 100.4645717,
      longitudePerihelionDeg: 102.9376819,
      longitudeAscendingNodeDeg: 0,
    },
  },
  {
    id: "mars",
    name: "Mars",
    massKg: 6.4171e23,
    radiusM: 3_389_500,
    color: 0xc76744,
    elements: {
      semiMajorAxisAu: 1.52371034,
      eccentricity: 0.0933941,
      inclinationDeg: 1.84969142,
      meanLongitudeDeg: -4.55343205,
      longitudePerihelionDeg: -23.94362959,
      longitudeAscendingNodeDeg: 49.55953891,
    },
  },
  {
    id: "jupiter",
    name: "Jupiter",
    massKg: 1.898_13e27,
    radiusM: 69_911_000,
    color: 0xd2ad83,
    elements: {
      semiMajorAxisAu: 5.202887,
      eccentricity: 0.04838624,
      inclinationDeg: 1.30439695,
      meanLongitudeDeg: 34.39644051,
      longitudePerihelionDeg: 14.72847983,
      longitudeAscendingNodeDeg: 100.4739091,
    },
  },
  {
    id: "saturn",
    name: "Saturn",
    massKg: 5.6834e26,
    radiusM: 58_232_000,
    color: 0xd8c28b,
    elements: {
      semiMajorAxisAu: 9.53667594,
      eccentricity: 0.05386179,
      inclinationDeg: 2.48599187,
      meanLongitudeDeg: 49.95424423,
      longitudePerihelionDeg: 92.59887831,
      longitudeAscendingNodeDeg: 113.6624245,
    },
  },
  {
    id: "uranus",
    name: "Uranus",
    massKg: 8.681e25,
    radiusM: 25_362_000,
    color: 0x88c9d4,
    elements: {
      semiMajorAxisAu: 19.18916464,
      eccentricity: 0.04725744,
      inclinationDeg: 0.77263783,
      meanLongitudeDeg: 313.2381045,
      longitudePerihelionDeg: 170.9542763,
      longitudeAscendingNodeDeg: 74.01692503,
    },
  },
  {
    id: "neptune",
    name: "Neptune",
    massKg: 1.024_09e26,
    radiusM: 24_622_000,
    color: 0x426fc7,
    elements: {
      semiMajorAxisAu: 30.06992276,
      eccentricity: 0.00859048,
      inclinationDeg: 1.77004347,
      meanLongitudeDeg: -55.12002969,
      longitudePerihelionDeg: 44.96476227,
      longitudeAscendingNodeDeg: 131.7842257,
    },
  },
];

export function createSolarSystem(): CelestialBody[] {
  const planets = PLANETS.map((planet): CelestialBody => {
    const state = orbitalElementsToState(planet.elements, SUN.massKg + planet.massKg);
    return {
      id: planet.id,
      name: planet.name,
      category: "planet",
      massKg: planet.massKg,
      radiusM: planet.radiusM,
      positionM: state.positionM,
      velocityMps: state.velocityMps,
      visual: { color: planet.color },
    };
  });

  let weightedPosition = vector();
  let weightedVelocity = vector();
  for (const planet of planets) {
    weightedPosition = add(weightedPosition, scale(planet.positionM, planet.massKg));
    weightedVelocity = add(weightedVelocity, scale(planet.velocityMps, planet.massKg));
  }

  return [
    {
      id: "sun",
      name: "Sun",
      category: "star",
      massKg: SUN.massKg,
      radiusM: SUN.radiusM,
      positionM: scale(weightedPosition, -1 / SUN.massKg),
      velocityMps: scale(weightedVelocity, -1 / SUN.massKg),
      visual: { color: 0xffd279, emissive: 0xffa62b },
    },
    ...planets,
  ];
}
