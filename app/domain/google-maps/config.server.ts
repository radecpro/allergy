export type GoogleMapsProviderConfig = {
  apiKey: string;
  placesAutocompleteUrl: string;
  geocodingUrl: string;
  pollenForecastUrl: string;
};

export type GoogleMapsConfigError = {
  status: "missing-api-key";
  message: string;
};

const googleMapsEndpoints = {
  placesAutocompleteUrl: "https://places.googleapis.com/v1/places:autocomplete",
  geocodingUrl: "https://maps.googleapis.com/maps/api/geocode/json",
  pollenForecastUrl: "https://pollen.googleapis.com/v1/forecast:lookup",
} as const;

export function getGoogleMapsProviderConfig():
  | { ok: true; config: GoogleMapsProviderConfig }
  | { ok: false; error: GoogleMapsConfigError } {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      error: {
        status: "missing-api-key",
        message: "Brak konfiguracji klucza Google Maps Platform.",
      },
    };
  }

  return {
    ok: true,
    config: {
      apiKey,
      ...googleMapsEndpoints,
    },
  };
}
