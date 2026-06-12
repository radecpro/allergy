import { searchGoogleCities } from "~/domain/current-location/google-city-search.server";
import {
  citySearchResponse,
  emptyCitySearchResponse,
  isValidCitySearchInput,
  methodNotAllowedResponse,
  readCurrentLocationRequestBody,
  sanitizeCitySearchInput,
} from "~/domain/current-location/http";
import type { Route } from "./+types/api.city-search";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return methodNotAllowedResponse();
  }

  const body = await readCurrentLocationRequestBody(request);
  const query = sanitizeCitySearchInput(
    typeof body?.query === "string" ? body.query : null,
  );

  if (!isValidCitySearchInput(query)) {
    return emptyCitySearchResponse();
  }

  return citySearchResponse(await searchGoogleCities(query));
}
