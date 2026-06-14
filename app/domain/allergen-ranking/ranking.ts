import { allergenCatalog, symptomCatalog } from "./catalog";
import {
  likelihoodLabels,
  pollenActivityLabels,
  symptomIntensityLabels,
} from "./labels";
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
  symptoms,
  pollenActivity,
}: CurrentSymptomRankingInput): CurrentSymptomRankedResult[] {
  const selectedSymptoms = new Map(
    symptoms.map((symptom) => [symptom.symptomId, symptom.intensity]),
  );

  return allergenCatalog
    .map((allergen, catalogIndex) => {
      const matchedSymptoms = allergen.symptomIds.flatMap((symptomId) => {
        const intensity = selectedSymptoms.get(symptomId);

        return intensity
          ? [{
              symptomId,
              label: getSymptomLabel(symptomId),
              intensity,
              intensityLabel: symptomIntensityLabels[intensity],
            }]
          : [];
      });
      const matchedSymptomIds = matchedSymptoms.map(({ symptomId }) => symptomId);
      const matchedSymptomLabels = matchedSymptoms.map(({ label }) => label);
      const activity = pollenActivity[allergen.id] ?? "unknown";
      const pollenActivityScore = pollenActivityScores[activity];
      const score =
        matchedSymptoms.reduce(
          (total, symptom) => total + intensityMultipliers[symptom.intensity],
          0,
        ) + pollenActivityScore;
      const likelihood = getLikelihood(score);

      return {
        result: {
          allergenId: allergen.id,
          allergenLabel: allergen.label,
          matchedSymptoms,
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
