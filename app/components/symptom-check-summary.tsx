import {
  allergenCatalog,
  pollenActivityLabels,
  symptomCatalog,
  symptomIntensityLabels,
} from "~/domain/allergen-ranking";
import type { SymptomCheckSnapshot } from "~/domain/symptom-checks/types";

type SymptomCheckSummaryProps = {
  snapshot: SymptomCheckSnapshot;
  compact?: boolean;
};

const symptomCheckDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Warsaw",
});

export function formatSymptomCheckCompletedAt(completedAt: string): string {
  return symptomCheckDateFormatter.format(new Date(completedAt));
}

export function SymptomCheckSummary({
  snapshot,
  compact = false,
}: SymptomCheckSummaryProps) {
  return (
    <div className="grid gap-3 text-sm">
      <div>
        <p className="font-medium text-slate-950">{snapshot.city.label}</p>
        <p className="text-slate-600">
          {formatSymptomCheckCompletedAt(snapshot.completedAt)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {snapshot.symptoms.map((entry) => {
          const label =
            symptomCatalog.find((symptom) => symptom.id === entry.symptomId)
              ?.label ?? entry.symptomId;

          return (
            <span
              key={entry.symptomId}
              className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-800"
            >
              {label}: {symptomIntensityLabels[entry.intensity]}
            </span>
          );
        })}
      </div>

      {!compact ? (
        <div className="grid gap-1 text-slate-600 sm:grid-cols-2">
          {Object.entries(snapshot.pollenActivity).map(
            ([allergenId, activity]) => {
              const label =
                allergenCatalog.find((allergen) => allergen.id === allergenId)
                  ?.label ?? allergenId;

              return (
                <p key={allergenId}>
                  {label}: {pollenActivityLabels[activity]}
                </p>
              );
            },
          )}
        </div>
      ) : null}
    </div>
  );
}
