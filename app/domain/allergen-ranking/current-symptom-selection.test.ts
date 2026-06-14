import { describe, expect, test } from "vitest";
import {
  assignSymptomIntensity,
  deselectSymptom,
  getCompleteSymptomEntries,
  hasCompleteSymptomSelection,
  selectSymptom,
} from "./current-symptom-selection";

describe("current symptom selection", () => {
  test("requires an independent assignment for every selected symptom", () => {
    const withFirst = selectSymptom([], "blocked-nose");
    const withBoth = selectSymptom(withFirst, "watery-eyes");

    expect(withBoth).toEqual([
      { symptomId: "blocked-nose", intensity: null },
      { symptomId: "watery-eyes", intensity: null },
    ]);
    expect(hasCompleteSymptomSelection(withBoth)).toBe(false);
    expect(getCompleteSymptomEntries(withBoth)).toEqual([]);

    const firstAssigned = assignSymptomIntensity(
      withBoth,
      "blocked-nose",
      "high",
    );
    expect(hasCompleteSymptomSelection(firstAssigned)).toBe(false);
    expect(getCompleteSymptomEntries(firstAssigned)).toEqual([
      { symptomId: "blocked-nose", intensity: "high" },
    ]);

    const bothAssigned = assignSymptomIntensity(
      firstAssigned,
      "watery-eyes",
      "low",
    );
    expect(hasCompleteSymptomSelection(bothAssigned)).toBe(true);
    expect(getCompleteSymptomEntries(bothAssigned)).toEqual([
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ]);
  });

  test("updates one assignment without changing order or other intensities", () => {
    const selection = [
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ] as const;

    expect(assignSymptomIntensity(selection, "blocked-nose", "low")).toEqual([
      { symptomId: "blocked-nose", intensity: "low" },
      { symptomId: "watery-eyes", intensity: "low" },
    ]);
  });

  test("keeps assigned entries available while a new symptom is incomplete", () => {
    const assigned = assignSymptomIntensity(
      selectSymptom([], "blocked-nose"),
      "blocked-nose",
      "high",
    );
    const withIncompleteSymptom = selectSymptom(assigned, "watery-eyes");

    expect(hasCompleteSymptomSelection(withIncompleteSymptom)).toBe(false);
    expect(getCompleteSymptomEntries(withIncompleteSymptom)).toEqual([
      { symptomId: "blocked-nose", intensity: "high" },
    ]);

    expect(
      getCompleteSymptomEntries(
        assignSymptomIntensity(
          withIncompleteSymptom,
          "watery-eyes",
          "low",
        ),
      ),
    ).toEqual([
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ]);
  });

  test("removes intensity on deselection and reselects as unassigned", () => {
    const assigned = [
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ] as const;
    const deselected = deselectSymptom(assigned, "blocked-nose");
    const reselected = selectSymptom(deselected, "blocked-nose");

    expect(deselected).toEqual([
      { symptomId: "watery-eyes", intensity: "low" },
    ]);
    expect(reselected).toEqual([
      { symptomId: "watery-eyes", intensity: "low" },
      { symptomId: "blocked-nose", intensity: null },
    ]);
    expect(hasCompleteSymptomSelection(reselected)).toBe(false);
  });

  test("does not duplicate an already selected symptom", () => {
    const selection = [
      { symptomId: "blocked-nose", intensity: "high" },
    ] as const;

    expect(selectSymptom(selection, "blocked-nose")).toBe(selection);
  });
});
