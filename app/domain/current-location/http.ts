import type { PollenActivityByAllergen } from "~/domain/allergen-ranking";
import { allergenIds } from "~/domain/allergen-ranking";
import type {
  CitySearchResult,
  CitySuggestion,
  CurrentLocationResolutionResult,
  CurrentLocationProviderStatus,
  SelectedCity,
} from "./types";

export const currentLocationRequestGuards = {
  minCitySearchLength: 2,
  maxCitySearchLength: 80,
  maxPlaceIdLength: 256,
  maxRequestBodyBytes: 1_024,
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
  message?: string;
};

export type CurrentLocationResponse = {
  status: CurrentLocationProviderStatus;
  city?: CitySuggestion;
  message?: string;
};

export type CurrentLocationCoordinates = {
  latitude: number;
  longitude: number;
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

export async function readCurrentLocationRequestBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get("Content-Length"));

  if (
    Number.isFinite(contentLength) &&
    contentLength > currentLocationRequestGuards.maxRequestBodyBytes
  ) {
    return null;
  }

  const reader = request.body?.getReader();

  if (!reader) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > currentLocationRequestGuards.maxRequestBodyBytes) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(body)) as unknown;
    return parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function methodNotAllowedResponse(): Response {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: "POST",
      "Cache-Control": "no-store",
    },
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

export function sanitizeCurrentLocationCoordinates(
  latitude: unknown,
  longitude: unknown,
): CurrentLocationCoordinates | null {
  const trimmedLatitude = typeof latitude === "string" ? latitude.trim() : null;
  const trimmedLongitude =
    typeof longitude === "string" ? longitude.trim() : null;

  if (trimmedLatitude === "" || trimmedLongitude === "") {
    return null;
  }

  const parsedLatitude =
    typeof latitude === "number"
      ? latitude
      : trimmedLatitude !== null
        ? Number(trimmedLatitude)
        : Number.NaN;
  const parsedLongitude =
    typeof longitude === "number"
      ? longitude
      : trimmedLongitude !== null
        ? Number(trimmedLongitude)
        : Number.NaN;

  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return null;
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
}

export function isValidCurrentLocationCoordinates(
  coordinates: CurrentLocationCoordinates | null,
): coordinates is CurrentLocationCoordinates {
  return (
    coordinates !== null &&
    coordinates.latitude >= -90 &&
    coordinates.latitude <= 90 &&
    coordinates.longitude >= -180 &&
    coordinates.longitude <= 180
  );
}

export function emptyCitySearchResponse(): Response {
  return Response.json(
    {
      status: "empty",
      suggestions: [],
    } satisfies CitySearchResponse,
    {
      status: 200,
      headers: responseHeaders("no-store"),
    },
  );
}

export function citySearchResponse(result: CitySearchResult): Response {
  return Response.json(
    {
      status: result.status,
      suggestions: result.suggestions,
      message: result.message,
    } satisfies CitySearchResponse,
    {
      status: 200,
      headers: responseHeaders("no-store"),
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
    headers: responseHeaders("no-store"),
  });
}

export function currentLocationResponse(
  result: CurrentLocationResolutionResult,
): Response {
  const payload: CurrentLocationResponse =
    result.status === "ok"
      ? {
          status: result.status,
          city: result.city,
        }
      : {
          status: result.status,
          message: result.message,
        };

  return Response.json(payload, {
    status: 200,
    headers: responseHeaders("no-store"),
  });
}
