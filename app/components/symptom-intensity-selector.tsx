import {
  symptomCatalog,
  symptomIntensityLabels,
} from "~/domain/allergen-ranking";
import type {
  CurrentSymptomSelection,
  SymptomId,
  SymptomIntensity,
} from "~/domain/allergen-ranking";

type SymptomIntensitySelectorProps = {
  selection: CurrentSymptomSelection;
  onAssign: (symptomId: SymptomId, intensity: SymptomIntensity) => void;
  onDeselect: (symptomId: SymptomId) => void;
};

export function SymptomIntensitySelector({
  selection,
  onAssign,
  onDeselect,
}: SymptomIntensitySelectorProps) {
  if (selection.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="symptom-intensity-heading" className="grid gap-3">
      <div>
        <h3 id="symptom-intensity-heading" className="text-sm font-medium">
          Nasilenie każdego objawu
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Wybierz niskie lub wysokie nasilenie dla każdego zaznaczonego objawu.
        </p>
      </div>

      <div className="grid gap-3">
        {selection.map((selected) => {
          const label =
            symptomCatalog.find(
              (symptom) => symptom.id === selected.symptomId,
            )?.label ?? selected.symptomId;
          const helperId = `symptom-intensity-${selected.symptomId}-helper`;

          return (
            <fieldset
              key={selected.symptomId}
              className="grid gap-3 rounded-md border border-slate-300 bg-white p-3"
              aria-describedby={helperId}
            >
              <legend className="px-1 text-sm font-medium text-slate-950">
                {label}
              </legend>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onDeselect(selected.symptomId)}
                  className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
                  aria-label={`Usuń objaw: ${label}`}
                >
                  Usuń
                </button>
              </div>

              <p
                id={helperId}
                className={`text-xs ${
                  selected.intensity === null
                    ? "font-medium text-amber-800"
                    : "text-slate-600"
                }`}
              >
                {selected.intensity === null
                  ? "Wybierz nasilenie, aby uwzględnić objaw w rankingu."
                  : `Wybrane nasilenie: ${symptomIntensityLabels[selected.intensity]}.`}
              </p>

              <div className="grid grid-cols-2 gap-2">
                {(["low", "high"] as const).map((intensity) => (
                  <label
                    key={intensity}
                    className={`flex min-h-10 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium transition ${
                      selected.intensity === intensity
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`symptom-intensity-${selected.symptomId}`}
                      value={intensity}
                      checked={selected.intensity === intensity}
                      onChange={() => onAssign(selected.symptomId, intensity)}
                      className="sr-only"
                    />
                    {symptomIntensityLabels[intensity]}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}
