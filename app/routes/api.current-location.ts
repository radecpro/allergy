import { resolveGoogleCurrentLocationCity } from "~/domain/current-location/google-current-location.server";
import {
  currentLocationResponse,
  isValidCurrentLocationCoordinates,
  methodNotAllowedResponse,
  readCurrentLocationRequestBody,
  sanitizeCurrentLocationCoordinates,
} from "~/domain/current-location/http";
import type { CurrentLocationResolutionResult } from "~/domain/current-location/types";
import type { Route } from "./+types/api.current-location";

type CurrentLocationDependencies = {
  resolveCity: (coordinates: {
    latitude: number;
    longitude: number;
  }) => Promise<CurrentLocationResolutionResult>;
};

export function createCurrentLocationAction(
  dependencies: CurrentLocationDependencies,
) {
  return async function currentLocationAction(request: Request) {
    if (request.method !== "POST") {
      return methodNotAllowedResponse();
    }

    const body = await readCurrentLocationRequestBody(request);
    const coordinates = sanitizeCurrentLocationCoordinates(
      body?.latitude,
      body?.longitude,
    );

    if (!isValidCurrentLocationCoordinates(coordinates)) {
      return currentLocationResponse({
        status: "invalid-input",
        message: "Nieprawidłowe współrzędne lokalizacji urządzenia.",
      });
    }

    return currentLocationResponse(await dependencies.resolveCity(coordinates));
  };
}

export async function action({ request }: Route.ActionArgs) {
  return createCurrentLocationAction({
    resolveCity: resolveGoogleCurrentLocationCity,
  })(request);
}
