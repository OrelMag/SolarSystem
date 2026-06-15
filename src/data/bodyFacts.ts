import type { EducationalFacts } from "../domain/orbits";

export const MASSIVE_BODY_FACTS: Readonly<Record<string, EducationalFacts>> = {
  sun: {
    discovery: "Known since prehistory.",
    significance: "The star containing more than 99.8% of the Solar System's mass.",
    surfaceGravityMps2: 274,
  },
  mercury: {
    discovery: "Known since antiquity.",
    significance: "The smallest planet and the closest planet to the Sun.",
    surfaceGravityMps2: 3.7,
  },
  venus: {
    discovery: "Known since antiquity.",
    significance: "Its dense carbon-dioxide atmosphere produces the hottest planetary surface.",
    surfaceGravityMps2: 8.87,
  },
  earth: {
    discovery: "Humanity's home world.",
    significance: "The only world currently known to support life and surface liquid oceans.",
    surfaceGravityMps2: 9.81,
  },
  mars: {
    discovery: "Known since antiquity.",
    significance: "A cold desert world with evidence that rivers and lakes existed in its past.",
    surfaceGravityMps2: 3.71,
  },
  jupiter: {
    discovery: "Known since antiquity.",
    significance: "The largest planet, with a mass greater than all other planets combined.",
    surfaceGravityMps2: 24.79,
  },
  saturn: {
    discovery: "Known since antiquity.",
    significance: "A gas giant surrounded by the Solar System's most extensive visible ring system.",
    surfaceGravityMps2: 10.44,
  },
  uranus: {
    discovery: "Discovered by William Herschel in 1781.",
    significance: "An ice giant rotating on its side, likely after an ancient giant impact.",
    surfaceGravityMps2: 8.69,
  },
  neptune: {
    discovery: "Discovered from mathematical predictions in 1846.",
    significance: "The outermost planet, with the fastest measured winds in the Solar System.",
    surfaceGravityMps2: 11.15,
  },
};
