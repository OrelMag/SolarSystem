import type { CelestialBody } from "../domain/types";
import {
  createHorizonsSolarSystem,
  HORIZONS_SOLAR_DATASET_METADATA,
} from "./horizonsSolarSystem";
import { MAJOR_MOONS, PLUTO } from "./satellites";

export const HORIZONS_EXTENDED_SOLAR_DATASET_METADATA = {
  datasetId: "jpl-horizons-extended-cartesian-j2000",
  epoch: HORIZONS_SOLAR_DATASET_METADATA.epoch,
  referenceFrame: HORIZONS_SOLAR_DATASET_METADATA.referenceFrame,
  source: HORIZONS_SOLAR_DATASET_METADATA.source,
  sourceUrl: HORIZONS_SOLAR_DATASET_METADATA.sourceUrl,
  originalUnits: HORIZONS_SOLAR_DATASET_METADATA.originalUnits,
  conversionApplied: HORIZONS_SOLAR_DATASET_METADATA.conversionApplied,
  notes:
    "Queried with EPHEM_TYPE=VECTORS, CENTER='@0', OUT_UNITS='KM-S', " +
    "REF_SYSTEM='J2000', REF_PLANE='ECLIPTIC', VEC_TABLE='2'. Includes " +
    "Sun, eight planets, Pluto, and 12 major moons.",
} as const;

interface HorizonsExtendedVector {
  readonly id: string;
  readonly command: string;
  readonly xKm: number;
  readonly yKm: number;
  readonly zKm: number;
  readonly vxKms: number;
  readonly vyKms: number;
  readonly vzKms: number;
}

const KM_TO_M = 1_000;

const HORIZONS_EXTENDED_VECTORS: readonly HorizonsExtendedVector[] = [
  {
    id: "sun",
    command: "10",
    xKm: -1_067_706.805_380_953,
    yKm: -418_275.271_819_447_3,
    zKm: 30_861.817_254_768_2,
    vxKms: 0.009_312_571_926_520_472,
    vyKms: -0.012_824_755_707_941_62,
    vzKms: -0.000_163_350_718_635_041_7,
  },
  {
    id: "mercury",
    command: "199",
    xKm: -20_529_433.161_234_68,
    yKm: -67_331_550.535_343_45,
    zKm: -3_648_992.526_494_771,
    vxKms: 37.004_304_429_205_71,
    vyKms: -11.177_240_681_326_44,
    vzKms: -4.307_791_469_376_854,
  },
  {
    id: "venus",
    command: "299",
    xKm: -108_524_200.857_571_5,
    yKm: -5_303_290.247_691_983,
    zKm: 6_166_496.116_973_171,
    vxKms: 1.391_218_601_189_967,
    vyKms: -35.153_119_932_154_64,
    vzKms: -0.560_205_689_000_715_9,
  },
  {
    id: "earth",
    command: "399",
    xKm: -27_566_740.482_811_45,
    yKm: 144_279_021.520_729_9,
    zKm: 30_250.667_828_813_2,
    vxKms: -29.784_947_498_510_88,
    vyKms: -5.482_119_695_478_543,
    vzKms: 0.000_018_432_959_867_809_02,
  },
  {
    id: "moon",
    command: "301",
    xKm: -27_858_348.866_999_16,
    yKm: 144_004_041.779_056_7,
    zKm: 66_521.864_455_804_23,
    vxKms: -29.141_416_109_521_93,
    vyKms: -6.213_103_678_165_645,
    vzKms: -0.011_488_031_779_318_67,
  },
  {
    id: "mars",
    command: "499",
    xKm: 206_980_433.836_461,
    yKm: -2_425_327.899_844_669,
    zKm: -5_125_427.142_013_255,
    vxKms: 1.171_984_975_692_608,
    vyKms: 26.283_239_789_754_72,
    vzKms: 0.522_133_672_276_650_5,
  },
  {
    id: "phobos",
    command: "401",
    xKm: 206_978_444.858_532_5,
    yKm: -2_434_615.423_505_503,
    zKm: -5_124_868.980_585_227,
    vxKms: 3.015_167_323_354_003,
    vyKms: 25.838_723_634_342_8,
    vzKms: -0.395_059_697_785_566,
  },
  {
    id: "deimos",
    command: "402",
    xKm: 206_990_800.276_749_6,
    yKm: -2_445_323.238_916_89,
    zKm: -5_131_957.686_006_251,
    vxKms: 2.212_841_442_567_695,
    vyKms: 26.986_010_126_113_41,
    vzKms: 0.022_468_762_285_493_33,
  },
  {
    id: "jupiter",
    command: "599",
    xKm: 597_499_917.851_683_5,
    yKm: 439_186_404.676_353_5,
    zKm: -15_195_999.855_732_71,
    vxKms: -7.900_547_720_245_487,
    vyKms: 11.143_392_770_659_34,
    vzKms: 0.130_702_330_863_731_4,
  },
  {
    id: "io",
    command: "501",
    xKm: 597_899_632.088_013,
    yKm: 439_315_671.327_300_1,
    zKm: -15_185_336.599_659_44,
    vxKms: -13.297_629_436_032_26,
    vyKms: 27.677_814_854_283_85,
    vzKms: 0.636_136_951_012_410_6,
  },
  {
    id: "europa",
    command: "502",
    xKm: 596_938_673.377_936_1,
    yKm: 438_830_391.617_742_1,
    zKm: -15_213_953.953_371_91,
    vxKms: -0.438_252_873_011_129_5,
    vyKms: -0.545_107_920_927_027_6,
    vzKms: -0.086_585_903_876_816_58,
  },
  {
    id: "ganymede",
    command: "503",
    xKm: 596_678_572.756_823_2,
    yKm: 438_501_015.852_023_5,
    zKm: -15_230_557.593_081_06,
    vxKms: -0.912_910_621_600_103_1,
    vyKms: 2.805_854_102_115_39,
    vzKms: -0.099_643_738_408_088_93,
  },
  {
    id: "callisto",
    command: "504",
    xKm: 597_824_997.582_316_6,
    yKm: 441_038_664.710_055_2,
    zKm: -15_131_245.089_334_61,
    vxKms: -15.973_519_993_968_3,
    vyKms: 12.624_121_885_673_95,
    vzKms: 0.072_266_646_838_818,
  },
  {
    id: "saturn",
    command: "699",
    xKm: 957_317_652.110_340_7,
    yKm: 982_438_007.687_508_6,
    zKm: -55_182_117.881_500_36,
    vxKms: -7.421_900_386_838_12,
    vyKms: 6.723_930_997_200_832,
    vzKms: 0.177_574_942_620_573_1,
  },
  {
    id: "enceladus",
    command: "602",
    xKm: 957_479_362.207_681_8,
    yKm: 982_278_682.874_381_5,
    zKm: -55_114_331.308_119_54,
    vxKms: 1.797_308_777_381_544,
    vyKms: 14.052_225_364_010_95,
    vzKms: -4.556_888_049_911_015,
  },
  {
    id: "titan",
    command: "606",
    xKm: 956_370_849.171_891_8,
    yKm: 983_204_875.719_209_2,
    zKm: -55_485_077.869_177_04,
    vxKms: -10.983_243_906_194_95,
    vyKms: 3.244_904_659_561_764,
    vzKms: 2.322_752_827_158_846,
  },
  {
    id: "uranus",
    command: "799",
    xKm: 2_157_907_112.723_417,
    yKm: -2_055_043_811.740_037,
    zKm: -35_594_639.499_614_83,
    vxKms: 4.646_584_677_611_653,
    vyKms: 4.614_773_473_441_427,
    vzKms: -0.043_085_218_888_708_75,
  },
  {
    id: "titania",
    command: "703",
    xKm: 2_157_844_005.721_66,
    yKm: -2_055_090_252.834_458,
    zKm: -36_023_545.964_509_13,
    vxKms: 1.121_231_511_584_747,
    vyKms: 5.447_718_453_981_893,
    vzKms: 0.376_569_121_100_529_5,
  },
  {
    id: "neptune",
    command: "899",
    xKm: 2_513_978_764.682_338,
    yKm: -3_739_132_814.439_58,
    zKm: 19_063_079.231_096_27,
    vxKms: 4.474_587_749_877_043,
    vyKms: 3.063_155_425_183_056,
    vzKms: -0.166_411_993_588_086_4,
  },
  {
    id: "triton",
    command: "801",
    xKm: 2_513_773_078.772_471,
    yKm: -3_739_008_723.285_048,
    zKm: 19_324_138.460_690_02,
    vxKms: 7.465_046_811_851_868,
    vyKms: 6.151_737_498_435_433,
    vzKms: 0.721_622_355_233_507_9,
  },
  {
    id: "pluto",
    command: "999",
    xKm: -1_478_398_629.112_175,
    yKm: -4_182_993_142.808_315,
    zKm: 875_246_342.612_255_5,
    vxKms: 5.269_162_848_777_873,
    vyKms: -2.669_241_590_379_465,
    vzKms: -1.250_746_334_721_01,
  },
  {
    id: "charon",
    command: "901",
    xKm: -1_478_405_466.833_227,
    yKm: -4_183_007_623.407_843,
    zKm: 875_235_044.056_320_1,
    vxKms: 5.124_836_700_905_305,
    vyKms: -2.726_180_395_165_47,
    vzKms: -1.090_460_026_696_852,
  },
] as const;

const BASE_BODIES = createHorizonsSolarSystem();
const ORBITAL_BODIES = [PLUTO, ...MAJOR_MOONS] as const;

export function createHorizonsExtendedSolarSystem(): CelestialBody[] {
  const sources = new Map<string, CelestialBody | (typeof ORBITAL_BODIES)[number]>([
    ...BASE_BODIES.map((body) => [body.id, body] as const),
    ...ORBITAL_BODIES.map((body) => [body.id, body] as const),
  ]);

  return HORIZONS_EXTENDED_VECTORS.map((vector) => {
    const source = sources.get(vector.id);
    if (!source) throw new Error(`Missing Horizons extended body metadata: ${vector.id}.`);
    const category = source.category === "comet" ? "minor-body" : source.category;
    return {
      id: source.id,
      name: source.name,
      category,
      parentId: source.parentId,
      massKg: source.massKg,
      radiusM: source.radiusM,
      positionM: {
        x: vector.xKm * KM_TO_M,
        y: vector.yKm * KM_TO_M,
        z: vector.zKm * KM_TO_M,
      },
      velocityMps: {
        x: vector.vxKms * KM_TO_M,
        y: vector.vyKms * KM_TO_M,
        z: vector.vzKms * KM_TO_M,
      },
      visual: { ...source.visual },
    };
  });
}

export function horizonsExtendedQuerySummary(): string {
  return HORIZONS_EXTENDED_VECTORS.map((body) => `${body.id}:${body.command}`).join(", ");
}
