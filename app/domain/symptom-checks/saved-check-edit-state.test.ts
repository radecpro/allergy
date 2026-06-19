import { describe, expect, it } from "vitest";

import {
  assignSavedCheckSymptomIntensity,
  deselectSavedCheckSymptom,
  getSavedCheckEditSubmissionEntries,
  hasCompleteSavedCheckEditState,
  initializeSavedCheckEditState,
  isSavedCheckEditStateDirty,
  resetSavedCheckEditState,
  selectSavedCheckSymptom,
} from "./saved-check-edit-state";

describe("saved check edit state", () => {
  it("initializes the persisted symptom order as the reset baseline", () => {
    const state = initializeSavedCheckEditState([
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ]);

    expect(state.baseline).toEqual([
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ]);
    expect(state.draft).toEqual(state.baseline);
    expect(isSavedCheckEditStateDirty(state)).toBe(false);
    expect(hasCompleteSavedCheckEditState(state)).toBe(true);
    expect(getSavedCheckEditSubmissionEntries(state)).toEqual([
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ]);
  });

  it("marks the state dirty for selection, intensity, and deselection changes", () => {
    const initialized = initializeSavedCheckEditState([
      { symptomId: "blocked-nose", intensity: "high" },
    ]);
    const selected = selectSavedCheckSymptom(initialized, "watery-eyes");

    expect(isSavedCheckEditStateDirty(selected)).toBe(true);
    expect(hasCompleteSavedCheckEditState(selected)).toBe(false);
    expect(getSavedCheckEditSubmissionEntries(selected)).toEqual([
      { symptomId: "blocked-nose", intensity: "high" },
    ]);

    const assigned = assignSavedCheckSymptomIntensity(
      selected,
      "watery-eyes",
      "low",
    );

    expect(isSavedCheckEditStateDirty(assigned)).toBe(true);
    expect(hasCompleteSavedCheckEditState(assigned)).toBe(true);
    expect(getSavedCheckEditSubmissionEntries(assigned)).toEqual([
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ]);

    const deselected = deselectSavedCheckSymptom(assigned, "blocked-nose");

    expect(isSavedCheckEditStateDirty(deselected)).toBe(true);
    expect(hasCompleteSavedCheckEditState(deselected)).toBe(true);
    expect(getSavedCheckEditSubmissionEntries(deselected)).toEqual([
      { symptomId: "watery-eyes", intensity: "low" },
    ]);
  });

  it("restores the exact persisted baseline on cancel", () => {
    const initialized = initializeSavedCheckEditState([
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ]);
    const changed = assignSavedCheckSymptomIntensity(
      selectSavedCheckSymptom(initialized, "sneezing"),
      "sneezing",
      "low",
    );
    const reset = resetSavedCheckEditState(changed);

    expect(reset.draft).toEqual(initialized.baseline);
    expect(isSavedCheckEditStateDirty(reset)).toBe(false);
    expect(hasCompleteSavedCheckEditState(reset)).toBe(true);
  });

  it("requires a fresh intensity when a symptom is deselected and reselected", () => {
    const initialized = initializeSavedCheckEditState([
      { symptomId: "blocked-nose", intensity: "high" },
    ]);
    const removed = deselectSavedCheckSymptom(initialized, "blocked-nose");
    const reselected = selectSavedCheckSymptom(removed, "blocked-nose");

    expect(reselected.draft).toEqual([
      { symptomId: "blocked-nose", intensity: null },
    ]);
    expect(hasCompleteSavedCheckEditState(reselected)).toBe(false);
  });
});
