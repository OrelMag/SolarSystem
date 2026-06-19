import { describe, expect, it } from "vitest";
import {
  CONSERVATION_VALIDATION_CASES,
  runConservationValidation,
} from "./validation";

describe("conservation validation runs", () => {
  it("keeps deterministic long-run conservation within documented tolerances", () => {
    for (const validationCase of CONSERVATION_VALIDATION_CASES) {
      const result = runConservationValidation(validationCase);

      expect(result.stepCount, validationCase.id).toBeGreaterThan(0);
      expect(result.elapsedSeconds, validationCase.id).toBe(
        result.stepCount * validationCase.fixedTimestepSeconds,
      );
      expect(result.energyDrift, validationCase.id).toBeLessThanOrEqual(
        validationCase.maximumEnergyDrift,
      );
      expect(result.angularMomentumDrift, validationCase.id).toBeLessThanOrEqual(
        validationCase.maximumAngularMomentumDrift,
      );
      expect(result.passed, validationCase.id).toBe(true);
    }
  });
});
