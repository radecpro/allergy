import { afterEach, describe, expect, test, vi } from "vitest";
import { RouterContextProvider } from "react-router";
import { action as citySearchAction } from "~/routes/api.city-search";
import {
  action as currentLocationAction,
  createCurrentLocationAction,
} from "~/routes/api.current-location";
import { action as currentPollenAction } from "~/routes/api.current-pollen";
import {
  createUnknownPollenActivity,
  normalizeGooglePollenForecast,
} from "./google-pollen.server";
import type {
  CitySearchResponse,
  CurrentLocationResponse,
  CurrentPollenResponse,
} from "./http";

function routeActionArgs(request: Request) {
  return {
    request,
    params: {},
    context: new RouterContextProvider(),
    url: new URL(request.url),
    pattern: "",
  };
}

function postJson(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
    const response = await citySearchAction(
      routeActionArgs(postJson("/api/city-search", { query: "W" })),
    );
    const payload = await readJsonResponse<CitySearchResponse>(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: "empty",
      suggestions: [],
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("returns unknown pollen for a malformed place ID", async () => {
    const response = await currentPollenAction(
      routeActionArgs(
        postJson("/api/current-pollen", { placeId: "bad place" }),
      ),
    );
    const payload = await readJsonResponse<CurrentPollenResponse>(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe("invalid-input");
    expect(payload.pollenActivity).toEqual(createUnknownPollenActivity());
  });

  test("returns unknown pollen when the place ID is missing", async () => {
    const response = await currentPollenAction(
      routeActionArgs(postJson("/api/current-pollen", {})),
    );
    const payload = await readJsonResponse<CurrentPollenResponse>(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe("invalid-input");
    expect(payload.pollenActivity["grass-pollen"]).toBe("unknown");
  });

  test("rejects malformed and missing device coordinates", async () => {
    const malformedResponse = await currentLocationAction(
      routeActionArgs(
        postJson("/api/current-location", {
          latitude: "abc",
          longitude: 19.94498,
        }),
      ),
    );
    const missingResponse = await currentLocationAction(
      routeActionArgs(postJson("/api/current-location", {})),
    );

    expect(malformedResponse.status).toBe(200);
    expect(
      (await readJsonResponse<CurrentLocationResponse>(malformedResponse)).status,
    ).toBe("invalid-input");
    expect(
      (await readJsonResponse<CurrentLocationResponse>(missingResponse)).status,
    ).toBe("invalid-input");
  });

  test("rejects out-of-range device coordinates", async () => {
    const latitudeResponse = await currentLocationAction(
      routeActionArgs(
        postJson("/api/current-location", {
          latitude: 91,
          longitude: 19.94498,
        }),
      ),
    );
    const longitudeResponse = await currentLocationAction(
      routeActionArgs(
        postJson("/api/current-location", {
          latitude: 50.06465,
          longitude: -181,
        }),
      ),
    );

    expect(
      (await readJsonResponse<CurrentLocationResponse>(latitudeResponse)).status,
    ).toBe("invalid-input");
    expect(
      (await readJsonResponse<CurrentLocationResponse>(longitudeResponse)).status,
    ).toBe("invalid-input");
  });

  test("returns a safe unknown-pollen fallback when the API key is absent", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");

    const response = await currentPollenAction(
      routeActionArgs(
        postJson("/api/current-pollen", {
          placeId: "ChIJ0RhX1q6W_UYRSmXQuNBgj6g",
        }),
      ),
    );
    const payload = await readJsonResponse<CurrentPollenResponse>(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe("missing-api-key");
    expect(payload.pollenActivity["grass-pollen"]).toBe("unknown");
    expect(JSON.stringify(payload)).not.toContain("GOOGLE_MAPS_API_KEY");
  });

  test("returns a safe current-location fallback when the API key is absent", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");

    const response = await currentLocationAction(
      routeActionArgs(
        postJson("/api/current-location", {
          latitude: 50.06465,
          longitude: 19.94498,
        }),
      ),
    );
    const payload = await readJsonResponse<CurrentLocationResponse>(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe("missing-api-key");
    expect(payload.city).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("GOOGLE_MAPS_API_KEY");
  });

  test("resolves device coordinates through an injected dependency", async () => {
    const action = createCurrentLocationAction({
      resolveCity: async ({ latitude, longitude }) => {
        expect(latitude).toBe(50.06465);
        expect(longitude).toBe(19.94498);

        return {
          status: "ok",
          city: {
            placeId: "place-krakow",
            label: "Kraków",
            mainText: "Kraków",
            secondaryText: "Małopolskie, Polska",
            country: "Polska",
            adminArea: "Małopolskie",
            isPolandPriority: true,
          },
        };
      },
    });

    const response = await action(
      postJson("/api/current-location", {
        latitude: 50.06465,
        longitude: 19.94498,
      }),
    );
    const payload = await readJsonResponse<CurrentLocationResponse>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload).toMatchObject({
      status: "ok",
      city: {
        placeId: "place-krakow",
        label: "Kraków",
      },
    });
  });

  test("keeps location input out of request URLs and rejects GET requests", async () => {
    const cityRequest = postJson("/api/city-search", { query: "Kraków" });
    const currentLocationRequest = postJson("/api/current-location", {
      latitude: 50.06465,
      longitude: 19.94498,
    });
    const pollenRequest = postJson("/api/current-pollen", {
      placeId: "place-krakow",
    });

    expect(cityRequest.url).toBe("http://localhost/api/city-search");
    expect(currentLocationRequest.url).toBe("http://localhost/api/current-location");
    expect(pollenRequest.url).toBe("http://localhost/api/current-pollen");
    expect(
      (
        await citySearchAction(
          routeActionArgs(
            new Request("http://localhost/api/city-search?q=Kraków"),
          ),
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await currentLocationAction(
          routeActionArgs(
            new Request(
              "http://localhost/api/current-location?latitude=50.06465&longitude=19.94498",
            ),
          ),
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await currentPollenAction(
          routeActionArgs(
            new Request(
              "http://localhost/api/current-pollen?placeId=place-krakow",
            ),
          ),
        )
      ).status,
    ).toBe(405);
  });

  test("rejects malformed and oversized provider request bodies safely", async () => {
    const malformed = new Request("http://localhost/api/city-search", {
      method: "POST",
      body: "{bad-json",
    });
    const oversized = new Request("http://localhost/api/current-pollen", {
      method: "POST",
      headers: { "Content-Length": "2048" },
      body: JSON.stringify({ placeId: "place-krakow" }),
    });
    const oversizedCurrentLocation = new Request(
      "http://localhost/api/current-location",
      {
        method: "POST",
        headers: { "Content-Length": "2048" },
        body: JSON.stringify({ latitude: 50.06465, longitude: 19.94498 }),
      },
    );

    const cityResponse = await citySearchAction(routeActionArgs(malformed));
    const pollenResponse = await currentPollenAction(
      routeActionArgs(oversized),
    );
    const currentLocationResponse = await currentLocationAction(
      routeActionArgs(oversizedCurrentLocation),
    );

    expect(
      await readJsonResponse<CitySearchResponse>(cityResponse),
    ).toMatchObject({ status: "empty", suggestions: [] });
    expect(
      (await readJsonResponse<CurrentPollenResponse>(pollenResponse)).status,
    ).toBe("invalid-input");
    expect(
      (
        await readJsonResponse<CurrentLocationResponse>(
          currentLocationResponse,
        )
      ).status,
    ).toBe("invalid-input");
  });

  test("keeps precise coordinates out of current-location responses", async () => {
    const action = createCurrentLocationAction({
      resolveCity: async () => ({
        status: "ok",
        city: {
          placeId: "place-krakow",
          label: "Kraków",
          mainText: "Kraków",
          secondaryText: "Małopolskie, Polska",
          country: "Polska",
          adminArea: "Małopolskie",
          isPolandPriority: true,
        },
      }),
    });
    const response = await action(
      postJson("/api/current-location", {
        latitude: 50.06465,
        longitude: 19.94498,
      }),
    );
    const serializedPayload = JSON.stringify(
      await readJsonResponse<CurrentLocationResponse>(response),
    );

    expect(serializedPayload).not.toContain("50.06465");
    expect(serializedPayload).not.toContain("19.94498");
    expect(serializedPayload).not.toContain("latitude");
    expect(serializedPayload).not.toContain("longitude");
  });
});
