import type { PollenActivityByAllergen } from "~/domain/allergen-ranking";
import { allergenIds } from "~/domain/allergen-ranking";
import type {
  CitySearchResult,
  CitySuggestion,
  CurrentLocationProviderStatus,
  SelectedCity,
} from "./types";

export const currentLocationRequestGuards = {
  minCitySearchLength: 2,
  maxCitySearchLength: 80,
  maxPlaceIdLength: 256,
  providerTimeoutMs: 4_000,
} as const;

export type CitySearchResponse = {
  status: CurrentLocationProviderStatus;
  suggestions: CitySuggestion[];
  message?: string;
};

export type CurrentPollenResponse = {
  status: CurrentLocationProviderStatus;
  pollenActivity: PollenActivityByAllergen;
  city?: SelectedCity;
  message?: string;
};

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
} as const;

function responseHeaders(cacheControl: string): Headers {
  return new Headers({
    ...jsonHeaders,
    "Cache-Control": cacheControl,
  });
}

export function isValidCitySearchInput(query: string): boolean {
  return (
    query.length >= currentLocationRequestGuards.minCitySearchLength &&
    query.length <= currentLocationRequestGuards.maxCitySearchLength
  );
}

export function sanitizeCitySearchInput(input: string | null): string {
  return (input ?? "").trim().slice(0, currentLocationRequestGuards.maxCitySearchLength);
}

export function isValidPlaceId(placeId: string): boolean {
  return (
    placeId.length > 0 &&
    placeId.length <= currentLocationRequestGuards.maxPlaceIdLength &&
    /^[A-Za-z0-9:_-]+$/.test(placeId)
  );
}

export function sanitizePlaceId(input: string | null): string {
  return (input ?? "").trim().slice(0, currentLocationRequestGuards.maxPlaceIdLength);
}

export function emptyCitySearchResponse(): Response {
  return Response.json(
    {
      status: "empty",
      suggestions: [],
    } satisfies CitySearchResponse,
    {
      status: 200,
      headers: responseHeaders("public, max-age=60"),
    },
  );
}

export function citySearchResponse(result: CitySearchResult): Response {
  const cacheControl =
    result.status === "ok" || result.status === "empty"
      ? "public, max-age=60"
      : "no-store";

  return Response.json(
    {
      status: result.status,
      suggestions: result.suggestions,
      message: result.message,
    } satisfies CitySearchResponse,
    {
      status: 200,
      headers: responseHeaders(cacheControl),
    },
  );
}

export function unknownPollenResponse(
  status: Exclude<CurrentLocationProviderStatus, "ok" | "empty">,
  message: string,
): Response {
  const pollenActivity = Object.fromEntries(
    allergenIds.map((allergenId) => [allergenId, "unknown"]),
  ) as PollenActivityByAllergen;

  return Response.json(
    {
      status,
      pollenActivity,
      message,
    } satisfies CurrentPollenResponse,
    {
      status: 200,
      headers: responseHeaders("no-store"),
    },
  );
}

export function currentPollenResponse(payload: CurrentPollenResponse): Response {
  return Response.json(payload, {
    status: 200,
    headers: responseHeaders(payload.status === "ok" ? "public, max-age=300" : "no-store"),
  });
}
