import { allergenCatalog } from "./catalog";
import { pollenActivityLabels, symptomLabels } from "./labels";
import { createDestinationActivityExplanation } from "./explanations";
import type {
  DestinationPollenActivityInput,
  DestinationPollenActivitySummary,
} from "./types";

export function summarizeDestinationPollenActivity({
  pollenActivity,
}: DestinationPollenActivityInput): DestinationPollenActivitySummary[] {
  return allergenCatalog.map((allergen) => {
    const activity = pollenActivity[allergen.id] ?? "unknown";

    return {
      allergenId: allergen.id,
      allergenLabel: allergen.label,
      pollenActivity: activity,
      pollenActivityLabel: pollenActivityLabels[activity],
      possibleSymptomLabels: allergen.symptomIds.map(
        (symptomId) => symptomLabels[symptomId],
      ),
      explanation: createDestinationActivityExplanation({
        allergenLabel: allergen.label,
        pollenActivity: activity,
        pollenActivityLabel: pollenActivityLabels[activity],
      }),
    };
  });
}
