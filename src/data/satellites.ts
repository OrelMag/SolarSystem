import type { HierarchicalOrbitalBody } from "../domain/orbits";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";
import { makeElementsFromDegrees } from "../physics/orbitalMechanics";

const kmToAu = (kilometres: number): number =>
  (kilometres * 1_000) / ASTRONOMICAL_UNIT_M;

const source = (kind: "moon" | "pluto", epoch = 2_451_545) => ({
  name:
    kind === "moon"
      ? "NASA/JPL Planetary Satellite Parameters and Horizons"
      : "NASA/JPL Horizons",
  url:
    kind === "moon"
      ? "https://ssd.jpl.nasa.gov/sats/phys_par/"
      : "https://ssd.jpl.nasa.gov/horizons/",
  solutionEpochJulianDay: epoch,
  referenceFrame: "J2000 ecliptic; parent-relative approximate elements",
});

const moon = (input: {
  id: string;
  name: string;
  parentId: string;
  massKg: number;
  radiusKm: number;
  semiMajorAxisKm: number;
  eccentricity: number;
  inclinationDeg: number;
  meanAnomalyDeg: number;
  color: number;
  discovery: string;
  significance: string;
  surfaceGravityMps2: number;
}): HierarchicalOrbitalBody => ({
  id: input.id,
  name: input.name,
  parentId: input.parentId,
  category: "moon",
  massKg: input.massKg,
  radiusM: input.radiusKm * 1_000,
  visual: { color: input.color },
  elements: makeElementsFromDegrees({
    semiMajorAxisAu: kmToAu(input.semiMajorAxisKm),
    eccentricity: input.eccentricity,
    inclinationDeg: input.inclinationDeg,
    longitudeAscendingNodeDeg: 0,
    argumentPeriapsisDeg: 0,
    meanAnomalyDeg: input.meanAnomalyDeg,
    epochJulianDay: 2_451_545,
  }),
  source: source("moon"),
  facts: {
    discovery: input.discovery,
    significance: input.significance,
    surfaceGravityMps2: input.surfaceGravityMps2,
  },
});

export const PLUTO: HierarchicalOrbitalBody = {
  id: "pluto",
  name: "Pluto",
  parentId: "sun",
  category: "dwarf-planet",
  massKg: 1.303e22,
  radiusM: 1_188_300,
  visual: { color: 0xc7aa8e },
  elements: makeElementsFromDegrees({
    semiMajorAxisAu: 39.482,
    eccentricity: 0.2488,
    inclinationDeg: 17.14,
    longitudeAscendingNodeDeg: 110.3,
    argumentPeriapsisDeg: 113.8,
    meanAnomalyDeg: 14.9,
    epochJulianDay: 2_451_545,
  }),
  source: source("pluto"),
  facts: {
    discovery: "Discovered by Clyde Tombaugh in 1930.",
    significance: "A geologically active dwarf planet and the largest known body in the Kuiper belt.",
    surfaceGravityMps2: 0.62,
  },
};

export const MAJOR_MOONS: readonly HierarchicalOrbitalBody[] = [
  moon({
    id: "moon",
    name: "Moon",
    parentId: "earth",
    massKg: 7.342e22,
    radiusKm: 1_737.4,
    semiMajorAxisKm: 384_400,
    eccentricity: 0.0549,
    inclinationDeg: 5.145,
    meanAnomalyDeg: 135.27,
    color: 0xd5d2ca,
    discovery: "Known since prehistory.",
    significance: "Earth's only natural satellite stabilizes its axial tilt and drives ocean tides.",
    surfaceGravityMps2: 1.62,
  }),
  moon({
    id: "phobos",
    name: "Phobos",
    parentId: "mars",
    massKg: 1.066e16,
    radiusKm: 11.27,
    semiMajorAxisKm: 9_376,
    eccentricity: 0.0151,
    inclinationDeg: 1.08,
    meanAnomalyDeg: 40,
    color: 0x97877b,
    discovery: "Discovered by Asaph Hall in 1877.",
    significance: "It orbits Mars faster than Mars rotates and is slowly spiraling inward.",
    surfaceGravityMps2: 0.0057,
  }),
  moon({
    id: "deimos",
    name: "Deimos",
    parentId: "mars",
    massKg: 1.476e15,
    radiusKm: 6.2,
    semiMajorAxisKm: 23_463,
    eccentricity: 0.0003,
    inclinationDeg: 1.79,
    meanAnomalyDeg: 210,
    color: 0xaa9a8d,
    discovery: "Discovered by Asaph Hall in 1877.",
    significance: "The smaller and more distant of Mars's two irregular moons.",
    surfaceGravityMps2: 0.003,
  }),
  moon({
    id: "io",
    name: "Io",
    parentId: "jupiter",
    massKg: 8.932e22,
    radiusKm: 1_821.6,
    semiMajorAxisKm: 421_800,
    eccentricity: 0.0041,
    inclinationDeg: 0.05,
    meanAnomalyDeg: 10,
    color: 0xe7c85c,
    discovery: "Discovered by Galileo Galilei in 1610.",
    significance: "The most volcanically active body known, heated by Jupiter's tides.",
    surfaceGravityMps2: 1.796,
  }),
  moon({
    id: "europa",
    name: "Europa",
    parentId: "jupiter",
    massKg: 4.8e22,
    radiusKm: 1_560.8,
    semiMajorAxisKm: 671_100,
    eccentricity: 0.009,
    inclinationDeg: 0.47,
    meanAnomalyDeg: 80,
    color: 0xc9b28c,
    discovery: "Discovered by Galileo Galilei in 1610.",
    significance: "Its ice shell likely covers a global salty ocean with astrobiological potential.",
    surfaceGravityMps2: 1.315,
  }),
  moon({
    id: "ganymede",
    name: "Ganymede",
    parentId: "jupiter",
    massKg: 1.482e23,
    radiusKm: 2_634.1,
    semiMajorAxisKm: 1_070_400,
    eccentricity: 0.0013,
    inclinationDeg: 0.2,
    meanAnomalyDeg: 150,
    color: 0xa89a86,
    discovery: "Discovered by Galileo Galilei in 1610.",
    significance: "The Solar System's largest moon and the only moon with an intrinsic magnetic field.",
    surfaceGravityMps2: 1.428,
  }),
  moon({
    id: "callisto",
    name: "Callisto",
    parentId: "jupiter",
    massKg: 1.076e23,
    radiusKm: 2_410.3,
    semiMajorAxisKm: 1_882_700,
    eccentricity: 0.0074,
    inclinationDeg: 0.28,
    meanAnomalyDeg: 220,
    color: 0x80786e,
    discovery: "Discovered by Galileo Galilei in 1610.",
    significance: "Its ancient, heavily cratered surface preserves early Solar System history.",
    surfaceGravityMps2: 1.236,
  }),
  moon({
    id: "titan",
    name: "Titan",
    parentId: "saturn",
    massKg: 1.3452e23,
    radiusKm: 2_574.7,
    semiMajorAxisKm: 1_221_870,
    eccentricity: 0.0288,
    inclinationDeg: 0.35,
    meanAnomalyDeg: 30,
    color: 0xd8a955,
    discovery: "Discovered by Christiaan Huygens in 1655.",
    significance: "It has a dense atmosphere and stable lakes of liquid methane and ethane.",
    surfaceGravityMps2: 1.352,
  }),
  moon({
    id: "enceladus",
    name: "Enceladus",
    parentId: "saturn",
    massKg: 1.08e20,
    radiusKm: 252.1,
    semiMajorAxisKm: 238_020,
    eccentricity: 0.0047,
    inclinationDeg: 0.01,
    meanAnomalyDeg: 170,
    color: 0xe7edf0,
    discovery: "Discovered by William Herschel in 1789.",
    significance: "Water-rich plumes erupt from a subsurface ocean through its south polar crust.",
    surfaceGravityMps2: 0.113,
  }),
  moon({
    id: "titania",
    name: "Titania",
    parentId: "uranus",
    massKg: 3.527e21,
    radiusKm: 788.9,
    semiMajorAxisKm: 435_910,
    eccentricity: 0.0011,
    inclinationDeg: 0.08,
    meanAnomalyDeg: 250,
    color: 0xaeb7ba,
    discovery: "Discovered by William Herschel in 1787.",
    significance: "The largest moon of Uranus, with canyons and signs of geological resurfacing.",
    surfaceGravityMps2: 0.379,
  }),
  moon({
    id: "triton",
    name: "Triton",
    parentId: "neptune",
    massKg: 2.139e22,
    radiusKm: 1_353.4,
    semiMajorAxisKm: 354_760,
    eccentricity: 0.000016,
    inclinationDeg: 156.9,
    meanAnomalyDeg: 300,
    color: 0xc8b8b3,
    discovery: "Discovered by William Lassell in 1846.",
    significance: "Its retrograde orbit indicates capture, and Voyager 2 observed active nitrogen geysers.",
    surfaceGravityMps2: 0.779,
  }),
  moon({
    id: "charon",
    name: "Charon",
    parentId: "pluto",
    massKg: 1.586e21,
    radiusKm: 606,
    semiMajorAxisKm: 19_596,
    eccentricity: 0.0002,
    inclinationDeg: 0.08,
    meanAnomalyDeg: 45,
    color: 0xa8a19b,
    discovery: "Discovered by James Christy in 1978.",
    significance: "Charon is so large relative to Pluto that both orbit a barycenter outside Pluto.",
    surfaceGravityMps2: 0.288,
  }),
];

export const EXPLORATION_BODIES: readonly HierarchicalOrbitalBody[] = [
  PLUTO,
  ...MAJOR_MOONS,
];
