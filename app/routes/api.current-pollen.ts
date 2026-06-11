import { geocodeGooglePlace } from "~/domain/current-location/google-place-geocoding.server";
import { lookupGooglePollen } from "~/domain/current-location/google-pollen.server";
import {
  currentPollenResponse,
  isValidPlaceId,
  sanitizePlaceId,
  unknownPollenResponse,
} from "~/domain/current-location/http";
import type { Route } from "./+types/api.current-pollen";

type CurrentPollenDependencies = {
  geocode: typeof geocodeGooglePlace;
  lookupPollen: typeof lookupGooglePollen;
};

export function createCurrentPollenLoader(
  dependencies: CurrentPollenDependencies,
) {
  return async function currentPollenLoader(request: Request) {
  const url = new URL(request.url);
  const placeId = sanitizePlaceId(url.searchParams.get("placeId"));

  if (!isValidPlaceId(placeId)) {
    return unknownPollenResponse(
      "invalid-input",
      "Nieprawidłowy identyfikator wybranego miasta.",
    );
  }

  const geocodingResult = await dependencies.geocode(placeId);

  if (geocodingResult.status !== "ok") {
    return unknownPollenResponse(geocodingResult.status, geocodingResult.message);
  }

  const pollenResult = await dependencies.lookupPollen(geocodingResult.city);

  return currentPollenResponse({
    status: pollenResult.status,
    pollenActivity: pollenResult.pollenActivity,
    message: pollenResult.message,
  });
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  return createCurrentPollenLoader({
    geocode: geocodeGooglePlace,
    lookupPollen: lookupGooglePollen,
  })(request);
}
