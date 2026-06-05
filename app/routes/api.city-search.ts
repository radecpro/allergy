import { searchGoogleCities } from "~/domain/current-location/google-city-search.server";
import {
  citySearchResponse,
  emptyCitySearchResponse,
  isValidCitySearchInput,
  sanitizeCitySearchInput,
} from "~/domain/current-location/http";
import type { Route } from "./+types/api.city-search";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = sanitizeCitySearchInput(url.searchParams.get("q"));

  if (!isValidCitySearchInput(query)) {
    return emptyCitySearchResponse();
  }

  return citySearchResponse(await searchGoogleCities(query));
}
