import { getGoogleMapsProviderConfig } from "~/domain/google-maps/config.server";
import { currentLocationRequestGuards } from "./http";
import type { CitySearchResult, CitySuggestion } from "./types";

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

function toSuggestion(
  prediction: NonNullable<GoogleAutocompleteResponse["suggestions"]>[number],
  options: { forcePolandPriority?: boolean } = {},
): CitySuggestion | null {
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
    isPolandPriority:
      options.forcePolandPriority || isPolandText(`${label} ${secondaryText ?? ""}`),
  };
}

function sortPolandFirst(suggestions: CitySuggestion[]): CitySuggestion[] {
  return [...suggestions].sort((left, right) => {
    if (left.isPolandPriority !== right.isPolandPriority) {
      return left.isPolandPriority ? -1 : 1;
    }

    return left.label.localeCompare(right.label, "pl");
  });
}

async function requestGoogleCitySuggestions({
  apiKey,
  input,
  placesAutocompleteUrl,
  signal,
  onlyPoland,
}: {
  apiKey: string;
  input: string;
  placesAutocompleteUrl: string;
  signal: AbortSignal;
  onlyPoland: boolean;
}): Promise<CitySuggestion[] | null> {
  const response = await fetch(placesAutocompleteUrl, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": autocompleteFieldMask,
    },
    body: JSON.stringify({
      input,
      includedPrimaryTypes: ["(cities)"],
      languageCode: "pl",
      regionCode: "PL",
      ...(onlyPoland ? { includedRegionCodes: ["pl"] } : {}),
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as GoogleAutocompleteResponse;

  return (payload.suggestions ?? [])
    .map((prediction) =>
      toSuggestion(prediction, { forcePolandPriority: onlyPoland }),
    )
    .filter((suggestion): suggestion is CitySuggestion => suggestion !== null);
}

function deduplicateSuggestions(suggestions: CitySuggestion[]): CitySuggestion[] {
  const seenPlaceIds = new Set<string>();

  return suggestions.filter((suggestion) => {
    if (seenPlaceIds.has(suggestion.placeId)) {
      return false;
    }

    seenPlaceIds.add(suggestion.placeId);
    return true;
  });
}

export async function searchGoogleCities(input: string): Promise<CitySearchResult> {
  const query = input.trim();

  if (query.length < currentLocationRequestGuards.minCitySearchLength) {
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
  const timeout = setTimeout(
    () => abortController.abort(),
    currentLocationRequestGuards.providerTimeoutMs,
  );

  try {
    const polishSuggestions = await requestGoogleCitySuggestions({
      apiKey: configResult.config.apiKey,
      input: query,
      placesAutocompleteUrl: configResult.config.placesAutocompleteUrl,
      signal: abortController.signal,
      onlyPoland: true,
    });

    const globalSuggestions = await requestGoogleCitySuggestions({
      apiKey: configResult.config.apiKey,
      input: query,
      placesAutocompleteUrl: configResult.config.placesAutocompleteUrl,
      signal: abortController.signal,
      onlyPoland: false,
    });

    if (polishSuggestions === null && globalSuggestions === null) {
      return {
        status: "provider-unavailable",
        suggestions: [],
        message: "Wyszukiwarka miast jest chwilowo niedostępna.",
      };
    }

    const suggestions = deduplicateSuggestions([
      ...(polishSuggestions ?? []),
      ...(globalSuggestions ?? []),
    ]);

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
