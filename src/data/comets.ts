import type { MasslessOrbitalBody } from "../domain/orbits";
import { makeElementsFromDegrees } from "../physics/orbitalMechanics";

const source = (query: string, epoch: number) => ({
  name: "NASA/JPL Small-Body Database",
  url: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(query)}`,
  solutionEpochJulianDay: epoch,
  referenceFrame: "J2000 ecliptic",
});

export const COMETS: readonly MasslessOrbitalBody[] = [
  {
    id: "1p-halley",
    name: "1P/Halley",
    category: "comet",
    radiusM: 5_500,
    visual: { color: 0xbdeeff },
    elements: makeElementsFromDegrees({
      semiMajorAxisAu: 17.92863504856923,
      eccentricity: 0.9679359956953211,
      inclinationDeg: 162.1905300439129,
      longitudeAscendingNodeDeg: 59.09894720612437,
      argumentPeriapsisDeg: 112.2414314637764,
      meanAnomalyDeg: 274.3823371366792,
      epochJulianDay: 2_439_875.5,
    }),
    source: source("1P", 2_439_875.5),
  },
  {
    id: "c1995-o1-hale-bopp",
    name: "C/1995 O1 Hale-Bopp",
    category: "comet",
    radiusM: 30_000,
    visual: { color: 0xd9f7ff },
    elements: makeElementsFromDegrees({
      semiMajorAxisAu: 177.4333839117583,
      eccentricity: 0.9949810027633206,
      inclinationDeg: 89.28759424740302,
      longitudeAscendingNodeDeg: 282.7334213961641,
      argumentPeriapsisDeg: 130.4146670659176,
      meanAnomalyDeg: 3.878386339423241,
      epochJulianDay: 2_459_837.5,
    }),
    source: source("C/1995 O1", 2_459_837.5),
  },
  {
    id: "2p-encke",
    name: "2P/Encke",
    category: "comet",
    radiusM: 2_400,
    visual: { color: 0x9de4ee },
    elements: makeElementsFromDegrees({
      semiMajorAxisAu: 2.219688710074586,
      eccentricity: 0.8477496967533629,
      inclinationDeg: 11.41227811179314,
      longitudeAscendingNodeDeg: 334.1935846036774,
      argumentPeriapsisDeg: 187.1342463695676,
      meanAnomalyDeg: 243.1260693210057,
      epochJulianDay: 2_459_847.5,
    }),
    source: source("2P", 2_459_847.5),
  },
  {
    id: "67p-churyumov-gerasimenko",
    name: "67P/Churyumov-Gerasimenko",
    category: "comet",
    radiusM: 2_000,
    visual: { color: 0xa5dfe8 },
    elements: makeElementsFromDegrees({
      semiMajorAxisAu: 3.462249489765068,
      eccentricity: 0.6409081306555051,
      inclinationDeg: 7.040294906760007,
      longitudeAscendingNodeDeg: 50.13557380441372,
      argumentPeriapsisDeg: 12.79824973415729,
      meanAnomalyDeg: 8.859927418758764,
      epochJulianDay: 2_457_305.5,
    }),
    source: source("67P", 2_457_305.5),
  },
];
