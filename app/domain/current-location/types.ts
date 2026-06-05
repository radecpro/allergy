import type { PollenActivityByAllergen } from "~/domain/allergen-ranking";

export type CurrentLocationProviderStatus =
  | "ok"
  | "empty"
  | "invalid-input"
  | "missing-api-key"
  | "provider-unavailable"
  | "not-found";

export type CitySuggestion = {
  placeId: string;
  label: string;
  mainText: string;
  secondaryText?: string;
  country?: string;
  adminArea?: string;
  isPolandPriority: boolean;
};

export type CitySearchResult = {
  status: CurrentLocationProviderStatus;
  suggestions: CitySuggestion[];
  message?: string;
};

export type SelectedCity = {
  placeId: string;
  label: string;
  latitude: number;
  longitude: number;
  country?: string;
  adminArea?: string;
};

export type CityGeocodingResult =
  | {
      status: "ok";
      city: SelectedCity;
    }
  | {
      status: Exclude<CurrentLocationProviderStatus, "ok" | "empty">;
      message: string;
    };

export type PollenLookupResult = {
  status: CurrentLocationProviderStatus;
  pollenActivity: PollenActivityByAllergen;
  message?: string;
};
