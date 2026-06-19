import { describe, expect, it } from "vitest";

import { formatSymptomCheckCompletedAt } from "./symptom-check-summary";

describe("symptom-check completion time", () => {
  it("uses the product timezone independently of the runtime timezone", () => {
    expect(
      formatSymptomCheckCompletedAt("2026-06-11T20:00:00.000Z"),
    ).toBe("11 cze 2026, 22:00");
  });
});
