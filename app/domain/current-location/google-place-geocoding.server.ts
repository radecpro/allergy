import { getGoogleMapsProviderConfig } from "~/domain/google-maps/config.server";
import { currentLocationRequestGuards } from "./http";
import type { CityGeocodingResult } from "./types";

type GoogleGeocodingResponse = {
  status?: string;
  results?: Array<{
    place_id?: string;
    formatted_address?: string;
    address_components?: Array<{
      long_name?: string;
      types?: string[];
    }>;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

function getAddressComponent(
  result: NonNullable<GoogleGeocodingResponse["results"]>[number],
  type: string,
): string | undefined {
  return result.address_components?.find((component) => component.types?.includes(type))?.long_name;
}

export async function geocodeGooglePlace(placeId: string): Promise<CityGeocodingResult> {
  const selectedPlaceId = placeId.trim();

  if (!selectedPlaceId) {
    return {
      status: "invalid-input",
      message: "Nieprawidłowy identyfikator wybranego miasta.",
    };
  }

  const configResult = getGoogleMapsProviderConfig();

  if (!configResult.ok) {
    return {
      status: configResult.error.status,
      message: configResult.error.message,
    };
  }

  const url = new URL(configResult.config.geocodingUrl);
  url.searchParams.set("place_id", selectedPlaceId);
  url.searchParams.set("language", "pl");
  url.searchParams.set("key", configResult.config.apiKey);

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    currentLocationRequestGuards.providerTimeoutMs,
  );

  try {
    const response = await fetch(url, { signal: abortController.signal });

    if (!response.ok) {
      return {
        status: "provider-unavailable",
        message: "Nie udało się odczytać położenia miasta.",
      };
    }

    const payload = (await response.json()) as GoogleGeocodingResponse;
    const firstResult = payload.results?.[0];
    const location = firstResult?.geometry?.location;

    if (payload.status === "ZERO_RESULTS" || !firstResult || !location) {
      return {
        status: "not-found",
        message: "Nie znaleziono położenia wybranego miasta.",
      };
    }

    if (typeof location.lat !== "number" || typeof location.lng !== "number") {
      return {
        status: "provider-unavailable",
        message: "Dane położenia miasta są chwilowo niedostępne.",
      };
    }

    return {
      status: "ok",
      city: {
        placeId: firstResult.place_id ?? selectedPlaceId,
        label: firstResult.formatted_address ?? selectedPlaceId,
        latitude: location.lat,
        longitude: location.lng,
        country: getAddressComponent(firstResult, "country"),
        adminArea: getAddressComponent(firstResult, "administrative_area_level_1"),
      },
    };
  } catch {
    return {
      status: "provider-unavailable",
      message: "Nie udało się odczytać położenia miasta.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
