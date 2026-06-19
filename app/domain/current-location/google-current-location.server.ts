import { getGoogleMapsProviderConfig } from "~/domain/google-maps/config.server";
import { currentLocationRequestGuards } from "./http";
import type {
  CitySuggestion,
  CurrentLocationResolutionResult,
} from "./types";

type GoogleReverseGeocodingResponse = {
  status?: string;
  results?: GoogleReverseGeocodingResult[];
};

type GoogleReverseGeocodingResult = {
  place_id?: string;
  formatted_address?: string;
  types?: string[];
  address_components?: Array<{
    long_name?: string;
    short_name?: string;
    types?: string[];
  }>;
};

const cityLikeTypes = new Set([
  "locality",
  "postal_town",
  "administrative_area_level_2",
  "administrative_area_level_3",
]);

function getAddressComponent(
  result: GoogleReverseGeocodingResult,
  type: string,
) {
  return result.address_components?.find((component) =>
    component.types?.includes(type),
  );
}

function componentLongName(
  result: GoogleReverseGeocodingResult,
  type: string,
): string | undefined {
  return getAddressComponent(result, type)?.long_name?.trim() || undefined;
}

function isPolandResult(result: GoogleReverseGeocodingResult): boolean {
  const country = getAddressComponent(result, "country");

  return (
    country?.short_name?.toUpperCase() === "PL" ||
    country?.long_name?.toLowerCase() === "polska" ||
    country?.long_name?.toLowerCase() === "poland"
  );
}

function cityNameFromResult(
  result: GoogleReverseGeocodingResult,
): string | undefined {
  return (
    componentLongName(result, "locality") ??
    componentLongName(result, "postal_town") ??
    componentLongName(result, "administrative_area_level_2") ??
    componentLongName(result, "administrative_area_level_3")
  );
}

function isCityLikeResult(result: GoogleReverseGeocodingResult): boolean {
  return (
    result.types?.some((type) => cityLikeTypes.has(type)) === true ||
    cityNameFromResult(result) !== undefined
  );
}

function toCitySuggestion(
  result: GoogleReverseGeocodingResult,
): CitySuggestion | null {
  const placeId = result.place_id?.trim();
  const mainText = cityNameFromResult(result);

  if (!placeId || !mainText) {
    return null;
  }

  const adminArea = componentLongName(result, "administrative_area_level_1");
  const country = componentLongName(result, "country");
  const secondaryText = [adminArea, country].filter(Boolean).join(", ") || undefined;

  return {
    placeId,
    label: mainText,
    mainText,
    secondaryText,
    country,
    adminArea,
    isPolandPriority: isPolandResult(result),
  };
}

export async function resolveGoogleCurrentLocationCity({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}): Promise<CurrentLocationResolutionResult> {
  const configResult = getGoogleMapsProviderConfig();

  if (!configResult.ok) {
    return {
      status: configResult.error.status,
      message: configResult.error.message,
    };
  }

  const url = new URL(configResult.config.geocodingUrl);
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("result_type", "locality|postal_town|administrative_area_level_2");
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
        message: "Nie udało się rozpoznać miasta z lokalizacji urządzenia.",
      };
    }

    const payload = (await response.json()) as GoogleReverseGeocodingResponse;

    if (payload.status !== undefined && payload.status !== "OK") {
      if (payload.status === "ZERO_RESULTS") {
        return {
          status: "not-found",
          message: "Nie znaleziono miasta dla lokalizacji urządzenia.",
        };
      }

      return {
        status: "provider-unavailable",
        message: "Nie udało się rozpoznać miasta z lokalizacji urządzenia.",
      };
    }

    const city = (payload.results ?? [])
      .filter(isCityLikeResult)
      .map(toCitySuggestion)
      .find((suggestion): suggestion is CitySuggestion => suggestion !== null);

    if (!city) {
      return {
        status: "not-found",
        message: "Nie znaleziono miasta dla lokalizacji urządzenia.",
      };
    }

    return {
      status: "ok",
      city,
    };
  } catch {
    return {
      status: "provider-unavailable",
      message: "Nie udało się rozpoznać miasta z lokalizacji urządzenia.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
