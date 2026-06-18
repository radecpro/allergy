import { symptomIntensityLabels } from "~/domain/allergen-ranking";
import type {
  SymptomId,
  SymptomIntensity,
} from "~/domain/allergen-ranking";

type SymptomIntensitySelectorProps = {
  symptomId: SymptomId;
  symptomLabel: string;
  intensity: SymptomIntensity | null;
  onAssign: (symptomId: SymptomId, intensity: SymptomIntensity) => void;
  disabled?: boolean;
};

export function SymptomIntensitySelector({
  symptomId,
  symptomLabel,
  intensity,
  onAssign,
  disabled = false,
}: SymptomIntensitySelectorProps) {
  const helperId = `symptom-intensity-${symptomId}-helper`;

  return (
    <fieldset
      className="grid gap-2 border-t border-emerald-200 px-3 pb-3 pt-2"
      aria-describedby={helperId}
      disabled={disabled}
    >
      <legend className="sr-only">Nasilenie objawu: {symptomLabel}</legend>
      <p
        id={helperId}
        className={`text-xs ${
          intensity === null
            ? "font-medium text-amber-800"
            : "text-emerald-900"
        }`}
      >
        {intensity === null
          ? "Wybierz nasilenie, aby uwzględnić objaw w rankingu."
          : `Nasilenie: ${symptomIntensityLabels[intensity]}.`}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {(["low", "high"] as const).map((option) => (
          <label
            key={option}
            className={`flex min-h-10 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium transition ${
              intensity === option
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-emerald-300 bg-white text-slate-700 hover:bg-emerald-100"
            }`}
          >
            <input
              type="radio"
              value={option}
              checked={intensity === option}
              onChange={() => onAssign(symptomId, option)}
              disabled={disabled}
              className="sr-only"
            />
            {symptomIntensityLabels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
