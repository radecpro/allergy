import { describe, expect, it } from "vitest";

import { symptomCheckSaveActionPath } from "./symptom-check-save";

describe("symptom-check save route", () => {
  it("targets the home index action instead of the root layout", () => {
    expect(symptomCheckSaveActionPath).toBe("/?index");
  });
});
