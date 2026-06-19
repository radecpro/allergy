import { describe, expect, it, vi } from "vitest";

import { allergenIds } from "~/domain/allergen-ranking";
import type { PollenActivityByAllergen } from "~/domain/allergen-ranking";
import type { CitySuggestion } from "./types";
import {
  createCurrentPollenLookup,
  emptyPollenActivity,
  type CurrentPollenState,
} from "./current-pollen";

function city(placeId: string, label: string): CitySuggestion {
  return {
    placeId,
    label,
    mainText: label,
    isPolandPriority: true,
  };
}

function pollenActivity(activity: "low" | "high"): PollenActivityByAllergen {
  return Object.fromEntries(
    allergenIds.map((allergenId) => [allergenId, activity]),
  ) as PollenActivityByAllergen;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("current pollen lookup", () => {
  it("does not let an older city response repaint a newer selection", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    const states: CurrentPollenState[] = [];
    const fetchCurrentPollen = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const lookup = createCurrentPollenLookup({
      fetchCurrentPollen,
      onState: (state) => states.push(state),
      unavailableMessage: "Niedostępne.",
    });

    lookup.setCity(city("place-warsaw", "Warszawa"));
    lookup.setCity(city("place-krakow", "Kraków"));

    first.resolve(
      jsonResponse({
        status: "ok",
        pollenActivity: pollenActivity("high"),
      }),
    );
    await flushPromises();

    expect(states.at(-1)).toEqual({
      pollenActivity: emptyPollenActivity,
      status: "loading",
      message: "",
    });

    second.resolve(
      jsonResponse({
        status: "ok",
        pollenActivity: pollenActivity("low"),
      }),
    );
    await flushPromises();

    expect(states.at(-1)).toEqual({
      pollenActivity: pollenActivity("low"),
      status: "idle",
      message: "",
    });
  });
});
