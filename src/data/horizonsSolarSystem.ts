import type { CelestialBody } from "../domain/types";

export const HORIZONS_SOLAR_DATASET_METADATA = {
  datasetId: "jpl-horizons-cartesian-j2000",
  epoch: "J2000.0 (2000-01-01T12:00:00.0000 TDB)",
  referenceFrame: "Solar System barycentric, ecliptic of J2000.0, DE441",
  source: "NASA/JPL Horizons API geometric vector table",
  sourceUrl: "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
  originalUnits: "Position in kilometres; velocity in kilometres per second",
  conversionApplied: "Position multiplied by 1,000; velocity multiplied by 1,000.",
  notes:
    "Queried with EPHEM_TYPE=VECTORS, CENTER='@0', OUT_UNITS='KM-S', REF_SYSTEM='J2000', REF_PLANE='ECLIPTIC', VEC_TABLE='2'.",
} as const;

interface HorizonsBodyVector {
  readonly id: string;
  readonly name: string;
  readonly category: CelestialBody["category"];
  readonly command: string;
  readonly massKg: number;
  readonly radiusM: number;
  readonly color: number;
  readonly emissive?: number;
  readonly xKm: number;
  readonly yKm: number;
  readonly zKm: number;
  readonly vxKms: number;
  readonly vyKms: number;
  readonly vzKms: number;
}

const KM_TO_M = 1_000;

const HORIZONS_VECTORS: readonly HorizonsBodyVector[] = [
  {
    id: "sun",
    name: "Sun",
    category: "star",
    command: "10",
    massKg: 1.988_47e30,
    radiusM: 696_340_000,
    color: 0xffd279,
    emissive: 0xffa62b,
    xKm: -1.067706805380953e6,
    yKm: -4.182752718194473e5,
    zKm: 3.08618172547682e4,
    vxKms: 9.312571926520472e-3,
    vyKms: -1.282475570794162e-2,
    vzKms: -1.633507186350417e-4,
  },
  {
    id: "mercury",
    name: "Mercury",
    category: "planet",
    command: "199",
    massKg: 3.3011e23,
    radiusM: 2_439_700,
    color: 0xa6a09a,
    xKm: -2.052943316123468e7,
    yKm: -6.733155053534345e7,
    zKm: -3.648992526494771e6,
    vxKms: 3.700430442920571e1,
    vyKms: -1.117724068132644e1,
    vzKms: -4.307791469376854,
  },
  {
    id: "venus",
    name: "Venus",
    category: "planet",
    command: "299",
    massKg: 4.8675e24,
    radiusM: 6_051_800,
    color: 0xd6ad68,
    xKm: -1.085242008575715e8,
    yKm: -5.303290247691983e6,
    zKm: 6.166496116973171e6,
    vxKms: 1.391218601189967,
    vyKms: -3.515311993215464e1,
    vzKms: -5.602056890007159e-1,
  },
  {
    id: "earth",
    name: "Earth",
    category: "planet",
    command: "399",
    massKg: 5.972_19e24,
    radiusM: 6_371_000,
    color: 0x4c86d9,
    xKm: -2.756674048281145e7,
    yKm: 1.442790215207299e8,
    zKm: 3.02506678288132e4,
    vxKms: -2.978494749851088e1,
    vyKms: -5.482119695478543,
    vzKms: 1.843295986780902e-5,
  },
  {
    id: "mars",
    name: "Mars",
    category: "planet",
    command: "499",
    massKg: 6.4171e23,
    radiusM: 3_389_500,
    color: 0xc76744,
    xKm: 2.06980433836461e8,
    yKm: -2.425327899844669e6,
    zKm: -5.125427142013255e6,
    vxKms: 1.171984975692608,
    vyKms: 2.628323978975472e1,
    vzKms: 5.221336722766505e-1,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    category: "planet",
    command: "599",
    massKg: 1.898_13e27,
    radiusM: 69_911_000,
    color: 0xd2ad83,
    xKm: 5.974999178516835e8,
    yKm: 4.391864046763535e8,
    zKm: -1.519599985573271e7,
    vxKms: -7.900547720245487,
    vyKms: 1.114339277065934e1,
    vzKms: 1.307023308637314e-1,
  },
  {
    id: "saturn",
    name: "Saturn",
    category: "planet",
    command: "699",
    massKg: 5.6834e26,
    radiusM: 58_232_000,
    color: 0xd8c28b,
    xKm: 9.573176521103407e8,
    yKm: 9.824380076875086e8,
    zKm: -5.518211788150036e7,
    vxKms: -7.42190038683812,
    vyKms: 6.723930997200832,
    vzKms: 1.775749426205731e-1,
  },
  {
    id: "uranus",
    name: "Uranus",
    category: "planet",
    command: "799",
    massKg: 8.681e25,
    radiusM: 25_362_000,
    color: 0x88c9d4,
    xKm: 2.157907112723417e9,
    yKm: -2.055043811740037e9,
    zKm: -3.559463949961483e7,
    vxKms: 4.646584677611653,
    vyKms: 4.614773473441427,
    vzKms: -4.308521888870875e-2,
  },
  {
    id: "neptune",
    name: "Neptune",
    category: "planet",
    command: "899",
    massKg: 1.024_09e26,
    radiusM: 24_622_000,
    color: 0x426fc7,
    xKm: 2.513978764682338e9,
    yKm: -3.73913281443958e9,
    zKm: 1.906307923109627e7,
    vxKms: 4.474587749877043,
    vyKms: 3.063155425183056,
    vzKms: -1.664119935880864e-1,
  },
] as const;

export function createHorizonsSolarSystem(): CelestialBody[] {
  return HORIZONS_VECTORS.map((body) => ({
    id: body.id,
    name: body.name,
    category: body.category,
    massKg: body.massKg,
    radiusM: body.radiusM,
    positionM: {
      x: body.xKm * KM_TO_M,
      y: body.yKm * KM_TO_M,
      z: body.zKm * KM_TO_M,
    },
    velocityMps: {
      x: body.vxKms * KM_TO_M,
      y: body.vyKms * KM_TO_M,
      z: body.vzKms * KM_TO_M,
    },
    visual: {
      color: body.color,
      ...(body.emissive === undefined ? {} : { emissive: body.emissive }),
    },
  }));
}

export function horizonsQuerySummary(): string {
  return HORIZONS_VECTORS.map((body) => `${body.id}:${body.command}`).join(", ");
}
