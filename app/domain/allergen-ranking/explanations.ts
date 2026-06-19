import { resultGuardrailText } from "./labels";
import type { PollenActivityLevel } from "./types";

type CurrentSymptomExplanationInput = {
  allergenLabel: string;
  matchedSymptomLabels: readonly string[];
  pollenActivity: PollenActivityLevel;
  pollenActivityLabel: string;
};

type DestinationActivityExplanationInput = {
  allergenLabel: string;
  pollenActivity: PollenActivityLevel;
  pollenActivityLabel: string;
};

export function createCurrentSymptomExplanation({
  allergenLabel,
  matchedSymptomLabels,
  pollenActivity,
  pollenActivityLabel,
}: CurrentSymptomExplanationInput): string {
  const symptomText =
    matchedSymptomLabels.length > 0
      ? `Zgłoszone objawy pasujące do tej grupy: ${matchedSymptomLabels.join(", ")}.`
      : "Zgłoszone objawy słabo pasują do tej grupy.";

  const pollenText =
    pollenActivity === "unknown"
      ? "Brak danych o aktualnej aktywności pyłków obniża pewność oceny."
      : `Aktualna aktywność dla grupy ${allergenLabel}: ${pollenActivityLabel.toLowerCase()}.`;

  return `${symptomText} ${pollenText} ${resultGuardrailText}`;
}

export function createDestinationActivityExplanation({
  allergenLabel,
  pollenActivity,
  pollenActivityLabel,
}: DestinationActivityExplanationInput): string {
  if (pollenActivity === "unknown") {
    return `Brak danych o aktywności dla grupy ${allergenLabel}. Wynik pokazuje tylko kontekst środowiskowy dla miejsca docelowego.`;
  }

  return `Aktywność środowiskowa dla grupy ${allergenLabel}: ${pollenActivityLabel.toLowerCase()}. Wynik nie określa osobistego prawdopodobieństwa objawów.`;
}
