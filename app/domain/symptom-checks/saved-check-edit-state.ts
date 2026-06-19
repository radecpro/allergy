import {
  assignSymptomIntensity,
  deselectSymptom,
  getCompleteSymptomEntries,
  hasCompleteSymptomSelection,
  selectSymptom,
  type CurrentSymptomSelection,
} from "~/domain/allergen-ranking";
import type { SymptomId, SymptomIntensity } from "~/domain/allergen-ranking";
import type { SavedSymptomEntry } from "./types";

export type SavedCheckEditState = {
  baseline: CurrentSymptomSelection;
  draft: CurrentSymptomSelection;
};

function toSelection(
  entries: readonly SavedSymptomEntry[],
): CurrentSymptomSelection {
  return entries.map((entry) => ({ ...entry }));
}

function selectionsEqual(
  left: CurrentSymptomSelection,
  right: CurrentSymptomSelection,
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.symptomId === right[index]?.symptomId &&
        entry.intensity === right[index]?.intensity,
    )
  );
}

export function initializeSavedCheckEditState(
  entries: readonly SavedSymptomEntry[],
): SavedCheckEditState {
  const baseline = toSelection(entries);

  return {
    baseline,
    draft: baseline,
  };
}

export function selectSavedCheckSymptom(
  state: SavedCheckEditState,
  symptomId: SymptomId,
): SavedCheckEditState {
  return {
    ...state,
    draft: selectSymptom(state.draft, symptomId),
  };
}

export function assignSavedCheckSymptomIntensity(
  state: SavedCheckEditState,
  symptomId: SymptomId,
  intensity: SymptomIntensity,
): SavedCheckEditState {
  return {
    ...state,
    draft: assignSymptomIntensity(state.draft, symptomId, intensity),
  };
}

export function deselectSavedCheckSymptom(
  state: SavedCheckEditState,
  symptomId: SymptomId,
): SavedCheckEditState {
  return {
    ...state,
    draft: deselectSymptom(state.draft, symptomId),
  };
}

export function resetSavedCheckEditState(
  state: SavedCheckEditState,
): SavedCheckEditState {
  return {
    ...state,
    draft: state.baseline,
  };
}

export function hasCompleteSavedCheckEditState(
  state: SavedCheckEditState,
): boolean {
  return hasCompleteSymptomSelection(state.draft);
}

export function isSavedCheckEditStateDirty(
  state: SavedCheckEditState,
): boolean {
  return !selectionsEqual(state.baseline, state.draft);
}

export function getSavedCheckEditSubmissionEntries(
  state: SavedCheckEditState,
): SavedSymptomEntry[] {
  return getCompleteSymptomEntries(state.draft);
}
