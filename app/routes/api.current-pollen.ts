import { geocodeGooglePlace } from "~/domain/current-location/google-place-geocoding.server";
import { lookupGooglePollen } from "~/domain/current-location/google-pollen.server";
import {
  currentPollenResponse,
  isValidPlaceId,
  sanitizePlaceId,
  unknownPollenResponse,
} from "~/domain/current-location/http";
import type { Route } from "./+types/api.current-pollen";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const placeId = sanitizePlaceId(url.searchParams.get("placeId"));

  if (!isValidPlaceId(placeId)) {
    return unknownPollenResponse(
      "invalid-input",
      "Nieprawidłowy identyfikator wybranego miasta.",
    );
  }

  const geocodingResult = await geocodeGooglePlace(placeId);

  if (geocodingResult.status !== "ok") {
    return unknownPollenResponse(geocodingResult.status, geocodingResult.message);
  }

  const pollenResult = await lookupGooglePollen(geocodingResult.city);

  return currentPollenResponse({
    status: pollenResult.status,
    pollenActivity: pollenResult.pollenActivity,
    city: geocodingResult.city,
    message: pollenResult.message,
  });
}
