import { afterEach, describe, expect, test, vi } from "vitest";
import { RouterContextProvider } from "react-router";
import { loader as citySearchLoader } from "~/routes/api.city-search";
import { loader as currentPollenLoader } from "~/routes/api.current-pollen";
import {
  createUnknownPollenActivity,
  normalizeGooglePollenForecast,
} from "./google-pollen.server";
import type { CitySearchResponse, CurrentPollenResponse } from "./http";

function routeLoaderArgs(url: string) {
  return {
    request: new Request(url),
    params: {},
    context: new RouterContextProvider(),
    url: new URL(url),
    pattern: "",
  };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Google pollen normalization", () => {
  test("maps provider indexes to the product pollen scale", () => {
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

    expect(normalized).toMatchObject({
      "grass-pollen": "very-high",
      "tree-pollen": "high",
      "weed-pollen": "moderate",
      "ragweed-pollen": "low",
    });
  });

  test("uses unknown for missing provider indexes and forecasts", () => {
    const missingIndexes = normalizeGooglePollenForecast({
      dailyInfo: [
        {
          pollenTypeInfo: [{ code: "GRASS" }],
          plantInfo: [{ code: "RAGWEED" }],
        },
      ],
    });
    const missingForecast = normalizeGooglePollenForecast({});

    expect(missingIndexes["grass-pollen"]).toBe("unknown");
    expect(missingIndexes["ragweed-pollen"]).toBe("unknown");
    expect(missingForecast["tree-pollen"]).toBe("unknown");
  });
});

describe("current-location resource routes", () => {
  test("returns no suggestions for a city query shorter than two characters", async () => {
    const response = await citySearchLoader(
      routeLoaderArgs("http://localhost/api/city-search?q=W"),
    );
    const payload = await readJsonResponse<CitySearchResponse>(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: "empty",
      suggestions: [],
    });
  });

  test("returns unknown pollen for a malformed place ID", async () => {
    const response = await currentPollenLoader(
      routeLoaderArgs("http://localhost/api/current-pollen?placeId=bad%20place"),
    );
    const payload = await readJsonResponse<CurrentPollenResponse>(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe("invalid-input");
    expect(payload.pollenActivity).toEqual(createUnknownPollenActivity());
  });

  test("returns unknown pollen when the place ID is missing", async () => {
    const response = await currentPollenLoader(
      routeLoaderArgs("http://localhost/api/current-pollen"),
    );
    const payload = await readJsonResponse<CurrentPollenResponse>(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe("invalid-input");
    expect(payload.pollenActivity["grass-pollen"]).toBe("unknown");
  });

  test("returns a safe unknown-pollen fallback when the API key is absent", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");

    const response = await currentPollenLoader(
      routeLoaderArgs(
        "http://localhost/api/current-pollen?placeId=ChIJ0RhX1q6W_UYRSmXQuNBgj6g",
      ),
    );
    const payload = await readJsonResponse<CurrentPollenResponse>(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe("missing-api-key");
    expect(payload.pollenActivity["grass-pollen"]).toBe("unknown");
    expect(JSON.stringify(payload)).not.toContain("GOOGLE_MAPS_API_KEY");
  });
});
