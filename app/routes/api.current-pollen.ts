import { geocodeGooglePlace } from "~/domain/current-location/google-place-geocoding.server";
import { lookupGooglePollen } from "~/domain/current-location/google-pollen.server";
import {
  currentPollenResponse,
  isValidPlaceId,
  methodNotAllowedResponse,
  readCurrentLocationRequestBody,
  sanitizePlaceId,
  unknownPollenResponse,
} from "~/domain/current-location/http";
import type { Route } from "./+types/api.current-pollen";

type CurrentPollenDependencies = {
  geocode: typeof geocodeGooglePlace;
  lookupPollen: typeof lookupGooglePollen;
};

export function createCurrentPollenAction(
  dependencies: CurrentPollenDependencies,
) {
  return async function currentPollenAction(request: Request) {
    if (request.method !== "POST") {
      return methodNotAllowedResponse();
    }

    const body = await readCurrentLocationRequestBody(request);
    const placeId = sanitizePlaceId(
      typeof body?.placeId === "string" ? body.placeId : null,
    );

    if (!isValidPlaceId(placeId)) {
      return unknownPollenResponse(
        "invalid-input",
        "Nieprawidłowy identyfikator wybranego miasta.",
      );
    }

    const geocodingResult = await dependencies.geocode(placeId);

    if (geocodingResult.status !== "ok") {
      return unknownPollenResponse(
        geocodingResult.status,
        geocodingResult.message,
      );
    }

    const pollenResult = await dependencies.lookupPollen(geocodingResult.city);

    return currentPollenResponse({
      status: pollenResult.status,
      pollenActivity: pollenResult.pollenActivity,
      message: pollenResult.message,
    });
  };
}

export async function action({ request }: Route.ActionArgs) {
  return createCurrentPollenAction({
    geocode: geocodeGooglePlace,
    lookupPollen: lookupGooglePollen,
  })(request);
}
