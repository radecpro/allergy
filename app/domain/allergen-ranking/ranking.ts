import { allergenCatalog, symptomCatalog } from "./catalog";
import { likelihoodLabels, pollenActivityLabels } from "./labels";
import { createCurrentSymptomExplanation } from "./explanations";
import type {
  CurrentSymptomRankedResult,
  CurrentSymptomRankingInput,
  LikelihoodLevel,
  PollenActivityLevel,
  SymptomId,
  SymptomIntensity,
} from "./types";

const intensityMultipliers = {
  low: 1,
  high: 2,
} as const satisfies Record<SymptomIntensity, number>;

const pollenActivityScores = {
  unknown: 0,
  low: 0,
  moderate: 1,
  high: 2,
  "very-high": 3,
} as const satisfies Record<PollenActivityLevel, number>;

function getLikelihood(score: number): LikelihoodLevel {
  if (score >= 5) {
    return "high";
  }

  if (score >= 3) {
    return "medium";
  }

  return "low";
}

function getSymptomLabel(symptomId: SymptomId): string {
  return symptomCatalog.find((symptom) => symptom.id === symptomId)?.label ?? symptomId;
}

export function rankCurrentSymptomAllergens({
  selectedSymptomIds,
  intensity,
  pollenActivity,
}: CurrentSymptomRankingInput): CurrentSymptomRankedResult[] {
  const selectedSymptoms = new Set(selectedSymptomIds);
  const intensityMultiplier = intensityMultipliers[intensity];

  return allergenCatalog
    .map((allergen, catalogIndex) => {
      const matchedSymptomIds = allergen.symptomIds.filter((symptomId) =>
        selectedSymptoms.has(symptomId),
      );
      const matchedSymptomLabels = matchedSymptomIds.map(getSymptomLabel);
      const activity = pollenActivity[allergen.id] ?? "unknown";
      const pollenActivityScore = pollenActivityScores[activity];
      const score = matchedSymptomIds.length * intensityMultiplier + pollenActivityScore;
      const likelihood = getLikelihood(score);

      return {
        result: {
          allergenId: allergen.id,
          allergenLabel: allergen.label,
          matchedSymptomIds,
          matchedSymptomLabels,
          likelihood,
          likelihoodLabel: likelihoodLabels[likelihood],
          pollenActivity: activity,
          pollenActivityLabel: pollenActivityLabels[activity],
          score,
          explanation: createCurrentSymptomExplanation({
            allergenLabel: allergen.label,
            matchedSymptomLabels,
            pollenActivity: activity,
            pollenActivityLabel: pollenActivityLabels[activity],
          }),
        } satisfies CurrentSymptomRankedResult,
        catalogIndex,
        pollenActivityScore,
      };
    })
    .sort((left, right) => {
      if (right.result.score !== left.result.score) {
        return right.result.score - left.result.score;
      }

      if (right.pollenActivityScore !== left.pollenActivityScore) {
        return right.pollenActivityScore - left.pollenActivityScore;
      }

      return left.catalogIndex - right.catalogIndex;
    })
    .map(({ result }) => result);
}

export {
  intensityMultipliers,
  pollenActivityScores,
};
