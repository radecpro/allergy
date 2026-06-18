import { describe, expect, it, vi } from "vitest";
import type { CitySuggestion } from "~/domain/current-location/types";
import {
  isCurrentLocationButtonDisabled,
  messageForGeolocationError,
  requestCurrentLocationCity,
  type CurrentLocationControlStatus,
} from "./current-location-control";

const resolvedCity: CitySuggestion = {
  placeId: "place-krakow",
  label: "Kraków, Małopolskie, Polska",
  mainText: "Kraków",
  secondaryText: "Małopolskie, Polska",
  country: "Polska",
  adminArea: "Małopolskie",
  isPolandPriority: true,
};

function position(latitude = 50.06465, longitude = 19.94498) {
  return {
    coords: {
      latitude,
      longitude,
    },
  } as GeolocationPosition;
}

function successfulGeolocation(): Geolocation {
  return {
    getCurrentPosition: vi.fn((success) => success(position())),
  } as unknown as Geolocation;
}

function failingGeolocation(code: number): Geolocation {
  return {
    getCurrentPosition: vi.fn((_success, error) => {
      error?.({ code } as GeolocationPositionError);
    }),
  } as unknown as Geolocation;
}

function responseJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function workflowHarness(options: {
  geolocation?: Geolocation;
  fetchCurrentLocation?: typeof fetch;
}) {
  const statuses: Array<{ status: CurrentLocationControlStatus; message: string }> = [];
  const onResolve = vi.fn();
  const abortController = new AbortController();
  const setTimeoutFn = vi.fn((callback: () => void) => {
    void callback;
    return 1;
  }) as unknown as typeof window.setTimeout;
  const clearTimeoutFn = vi.fn() as unknown as typeof window.clearTimeout;

  requestCurrentLocationCity({
    geolocation: options.geolocation,
    fetchCurrentLocation:
      options.fetchCurrentLocation ??
      (vi.fn(async () =>
        responseJson({
          status: "ok",
          city: resolvedCity,
        }),
      ) as unknown as typeof fetch),
    onResolve,
    onStatus: (status, message) => statuses.push({ status, message }),
    createAbortController: () => abortController,
    setTimeoutFn,
    clearTimeoutFn,
  });

  return {
    statuses,
    onResolve,
    setTimeoutFn,
    clearTimeoutFn,
  };
}

describe("current location control workflow", () => {
  it("reports unsupported geolocation without resolving a city", () => {
    const { statuses, onResolve } = workflowHarness({});

    expect(onResolve).not.toHaveBeenCalled();
    expect(statuses).toEqual([
      {
        status: "error",
        message:
          "Ta przeglądarka nie udostępnia lokalizacji. Wpisz miasto ręcznie.",
      },
    ]);
  });

  it("reports permission denial as a manual-city fallback", () => {
    const { statuses, onResolve } = workflowHarness({
      geolocation: failingGeolocation(1),
    });

    expect(onResolve).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toEqual({
      status: "error",
      message:
        "Nie uzyskano zgody na lokalizację. Możesz nadal wpisać miasto ręcznie.",
    });
  });

  it("reports browser timeout as a manual-city fallback", () => {
    expect(
      messageForGeolocationError({
        code: 3,
      }),
    ).toBe("Nie udało się ustalić lokalizacji w czasie. Wpisz miasto ręcznie.");
  });

  it("reports failed current-location responses without resolving a city", async () => {
    const fetchCurrentLocation = vi.fn(async () =>
      responseJson({
        status: "provider-unavailable",
        message: "Nie udało się rozpoznać miasta z lokalizacji urządzenia.",
      }),
    ) as unknown as typeof fetch;
    const { statuses, onResolve } = workflowHarness({
      geolocation: successfulGeolocation(),
      fetchCurrentLocation,
    });
    await flushPromises();

    expect(onResolve).not.toHaveBeenCalled();
    expect(statuses).toContainEqual({
      status: "error",
      message: "Nie udało się rozpoznać miasta z lokalizacji urządzenia.",
    });
  });

  it("resolves a city and posts coordinates only in the request body", async () => {
    const fetchCurrentLocation = vi.fn(async () =>
      responseJson({
        status: "ok",
        city: resolvedCity,
      }),
    ) as unknown as typeof fetch;
    const { statuses, onResolve } = workflowHarness({
      geolocation: successfulGeolocation(),
      fetchCurrentLocation,
    });
    await flushPromises();

    expect(fetchCurrentLocation).toHaveBeenCalledWith(
      "/api/current-location",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          latitude: 50.06465,
          longitude: 19.94498,
        }),
      }),
    );
    expect(onResolve).toHaveBeenCalledWith(resolvedCity);
    expect(statuses).toContainEqual({
      status: "idle",
      message: "Miasto ustawione na podstawie lokalizacji urządzenia.",
    });
  });

  it("keeps the locate button disabled while loading", () => {
    expect(
      isCurrentLocationButtonDisabled({ disabled: false, status: "loading" }),
    ).toBe(true);
    expect(
      isCurrentLocationButtonDisabled({ disabled: false, status: "idle" }),
    ).toBe(false);
    expect(
      isCurrentLocationButtonDisabled({ disabled: true, status: "idle" }),
    ).toBe(true);
  });
});
