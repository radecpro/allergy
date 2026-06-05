import { RouterContextProvider } from "react-router";
import { loader as citySearchLoader } from "~/routes/api.city-search";
import { loader as currentPollenLoader } from "~/routes/api.current-pollen";
import {
  createUnknownPollenActivity,
  normalizeGooglePollenForecast,
} from "./google-pollen.server";
import type { CitySearchResponse, CurrentPollenResponse } from "./http";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  assert(
    Object.is(actual, expected),
    `${message}. Expected ${String(expected)}, received ${String(actual)}.`,
  );
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function routeLoaderArgs(url: string) {
  return {
    request: new Request(url),
    params: {},
    context: new RouterContextProvider(),
    url: new URL(url),
    pattern: "",
  };
}

async function withUnsetGoogleMapsApiKey<T>(callback: () => Promise<T>): Promise<T> {
  const previousApiKey = process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;

  try {
    return await callback();
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.GOOGLE_MAPS_API_KEY;
    } else {
      process.env.GOOGLE_MAPS_API_KEY = previousApiKey;
    }
  }
}

function verifyGooglePollenNormalization(): void {
  const normalized = normalizeGooglePollenForecast({
    dailyInfo: [
      {
        pollenTypeInfo: [
          { code: "GRASS", indexInfo: { value: 4 } },
          { code: "TREE", indexInfo: { value: 3 } },
          { code: "WEED", indexInfo: { value: 2 } },
        ],
        plantInfo: [{ code: "RAGWEED", indexInfo: { value: 1 } }],
      },
    ],
  });

  assertEqual(normalized["grass-pollen"], "very-high", "GRASS maps to grass pollen");
  assertEqual(normalized["tree-pollen"], "high", "TREE maps to tree pollen");
  assertEqual(normalized["weed-pollen"], "moderate", "WEED maps to weed pollen");
  assertEqual(normalized["ragweed-pollen"], "low", "RAGWEED maps to ragweed pollen");

  const missingIndexes = normalizeGooglePollenForecast({
    dailyInfo: [
      {
        pollenTypeInfo: [{ code: "GRASS" }],
        plantInfo: [{ code: "RAGWEED" }],
      },
    ],
  });

  assertEqual(
    missingIndexes["grass-pollen"],
    "unknown",
    "Missing grass index falls back to unknown",
  );
  assertEqual(
    missingIndexes["ragweed-pollen"],
    "unknown",
    "Missing ragweed index falls back to unknown",
  );

  const missingForecast = normalizeGooglePollenForecast({});

  assertEqual(
    missingForecast["tree-pollen"],
    "unknown",
    "Missing forecast falls back to unknown pollen activity",
  );
}

async function verifyCitySearchShortInput(): Promise<void> {
  const response = await citySearchLoader(
    routeLoaderArgs("http://localhost/api/city-search?q=W"),
  );
  const payload = await readJsonResponse<CitySearchResponse>(response);

  assertEqual(response.status, 200, "Short city search returns 200");
  assertEqual(payload.status, "empty", "Short city search returns empty status");
  assertEqual(payload.suggestions.length, 0, "Short city search returns no suggestions");
}

async function verifyMalformedCurrentPollenPlaceId(): Promise<void> {
  const response = await currentPollenLoader(
    routeLoaderArgs("http://localhost/api/current-pollen?placeId=bad%20place"),
  );
  const payload = await readJsonResponse<CurrentPollenResponse>(response);
  const unknownActivity = createUnknownPollenActivity();

  assertEqual(response.status, 200, "Malformed placeId returns 200 fallback");
  assertEqual(payload.status, "invalid-input", "Malformed placeId returns invalid-input");

  for (const allergenId of Object.keys(unknownActivity) as Array<keyof typeof unknownActivity>) {
    assertEqual(
      payload.pollenActivity[allergenId],
      "unknown",
      `Malformed placeId keeps ${allergenId} unknown`,
    );
  }
}

async function verifyMissingCurrentPollenPlaceId(): Promise<void> {
  const response = await currentPollenLoader(
    routeLoaderArgs("http://localhost/api/current-pollen"),
  );
  const payload = await readJsonResponse<CurrentPollenResponse>(response);

  assertEqual(response.status, 200, "Missing placeId returns 200 fallback");
  assertEqual(payload.status, "invalid-input", "Missing placeId returns invalid-input");
  assertEqual(
    payload.pollenActivity["grass-pollen"],
    "unknown",
    "Missing placeId keeps pollen activity unknown",
  );
}

async function verifyMissingApiKeyCurrentPollenFallback(): Promise<void> {
  await withUnsetGoogleMapsApiKey(async () => {
    const response = await currentPollenLoader(
      routeLoaderArgs("http://localhost/api/current-pollen?placeId=ChIJ0RhX1q6W_UYRSmXQuNBgj6g"),
    );
    const payload = await readJsonResponse<CurrentPollenResponse>(response);

    assertEqual(response.status, 200, "Missing API key current pollen fallback returns 200");
    assertEqual(payload.status, "missing-api-key", "Missing API key returns missing-api-key");
    assertEqual(
      payload.pollenActivity["grass-pollen"],
      "unknown",
      "Missing API key keeps pollen activity unknown",
    );
    assert(
      !JSON.stringify(payload).includes("GOOGLE_MAPS_API_KEY"),
      "Missing API key fallback does not expose env variable names",
    );
  });
}

verifyGooglePollenNormalization();
await verifyCitySearchShortInput();
await verifyMalformedCurrentPollenPlaceId();
await verifyMissingCurrentPollenPlaceId();
await verifyMissingApiKeyCurrentPollenFallback();

console.log("Current-location smoke checks passed.");
