import { getGoogleMapsProviderConfig } from "~/domain/google-maps/config.server";
import type { CitySearchResult, CitySuggestion } from "./types";

const minCitySearchLength = 2;
const providerTimeoutMs = 4_000;
const autocompleteFieldMask =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat";

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: {
        text?: string;
      };
      structuredFormat?: {
        mainText?: {
          text?: string;
        };
        secondaryText?: {
          text?: string;
        };
      };
    };
  }>;
};

function isPolandText(text: string): boolean {
  return /\b(polska|poland)\b/i.test(text);
}

function parseCountry(secondaryText: string | undefined): string | undefined {
  if (!secondaryText) {
    return undefined;
  }

  const parts = secondaryText.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1);
}

function parseAdminArea(secondaryText: string | undefined): string | undefined {
  if (!secondaryText) {
    return undefined;
  }

  const parts = secondaryText.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.at(-2) : undefined;
}

function toSuggestion(prediction: NonNullable<GoogleAutocompleteResponse["suggestions"]>[number]): CitySuggestion | null {
  const placePrediction = prediction.placePrediction;
  const placeId = placePrediction?.placeId?.trim();
  const label = placePrediction?.text?.text?.trim();
  const mainText = placePrediction?.structuredFormat?.mainText?.text?.trim() ?? label;
  const secondaryText = placePrediction?.structuredFormat?.secondaryText?.text?.trim();

  if (!placeId || !label || !mainText) {
    return null;
  }

  return {
    placeId,
    label,
    mainText,
    secondaryText,
    country: parseCountry(secondaryText),
    adminArea: parseAdminArea(secondaryText),
    isPolandPriority: isPolandText(`${label} ${secondaryText ?? ""}`),
  };
}

function sortPolandFirst(suggestions: CitySuggestion[]): CitySuggestion[] {
  return [...suggestions].sort((left: CitySuggestion, right: CitySuggestion) => {
    if (left.isPolandPriority !== right.isPolandPriority) {
      return left.isPolandPriority ? -1 : 1;
    }

    return left.label.localeCompare(right.label, "pl");
  });
}

export async function searchGoogleCities(input: string): Promise<CitySearchResult> {
  const query = input.trim();

  if (query.length < minCitySearchLength) {
    return { status: "empty", suggestions: [] };
  }

  const configResult = getGoogleMapsProviderConfig();

  if (!configResult.ok) {
    return {
      status: configResult.error.status,
      suggestions: [],
      message: configResult.error.message,
    };
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), providerTimeoutMs);

  try {
    const response = await fetch(configResult.config.placesAutocompleteUrl, {
      method: "POST",
      signal: abortController.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": configResult.config.apiKey,
        "X-Goog-FieldMask": autocompleteFieldMask,
      },
      body: JSON.stringify({
        input: query,
        includedPrimaryTypes: ["(cities)"],
        languageCode: "pl",
        regionCode: "PL",
      }),
    });

    if (!response.ok) {
      return {
        status: "provider-unavailable",
        suggestions: [],
        message: "Wyszukiwarka miast jest chwilowo niedostępna.",
      };
    }

    const payload = (await response.json()) as GoogleAutocompleteResponse;
    const suggestions = (payload.suggestions ?? [])
      .map(toSuggestion)
      .filter((suggestion): suggestion is CitySuggestion => suggestion !== null);

    return {
      status: suggestions.length > 0 ? "ok" : "empty",
      suggestions: sortPolandFirst(suggestions),
    };
  } catch {
    return {
      status: "provider-unavailable",
      suggestions: [],
      message: "Wyszukiwarka miast jest chwilowo niedostępna.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
