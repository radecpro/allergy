import type {
  CurrentSymptomEntry,
  SymptomId,
  SymptomIntensity,
} from "./types";

export type SelectedSymptom = {
  symptomId: SymptomId;
  intensity: SymptomIntensity | null;
};

export type CurrentSymptomSelection = readonly SelectedSymptom[];

export function selectSymptom(
  selection: CurrentSymptomSelection,
  symptomId: SymptomId,
): CurrentSymptomSelection {
  if (selection.some((symptom) => symptom.symptomId === symptomId)) {
    return selection;
  }

  return [...selection, { symptomId, intensity: null }];
}

export function assignSymptomIntensity(
  selection: CurrentSymptomSelection,
  symptomId: SymptomId,
  intensity: SymptomIntensity,
): CurrentSymptomSelection {
  return selection.map((symptom) =>
    symptom.symptomId === symptomId ? { ...symptom, intensity } : symptom,
  );
}

export function deselectSymptom(
  selection: CurrentSymptomSelection,
  symptomId: SymptomId,
): CurrentSymptomSelection {
  return selection.filter((symptom) => symptom.symptomId !== symptomId);
}

export function hasCompleteSymptomSelection(
  selection: CurrentSymptomSelection,
): boolean {
  return (
    selection.length > 0 &&
    selection.every((symptom) => symptom.intensity !== null)
  );
}

export function getCompleteSymptomEntries(
  selection: CurrentSymptomSelection,
): CurrentSymptomEntry[] {
  return selection.flatMap((symptom) =>
    symptom.intensity === null
      ? []
      : [{ symptomId: symptom.symptomId, intensity: symptom.intensity }],
  );
}
