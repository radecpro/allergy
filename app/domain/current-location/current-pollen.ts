import { allergenIds } from "~/domain/allergen-ranking";
import type { PollenActivityByAllergen } from "~/domain/allergen-ranking";
import type { CurrentPollenResponse } from "./http";
import type { CitySuggestion } from "./types";

export type CurrentPollenStatus = "idle" | "loading" | "unavailable";

export type CurrentPollenState = {
  pollenActivity: PollenActivityByAllergen;
  status: CurrentPollenStatus;
  message: string;
};

type CurrentPollenLookupOptions = {
  fetchCurrentPollen: typeof fetch;
  createAbortController?: () => AbortController;
  onState: (state: CurrentPollenState) => void;
  unavailableMessage: string;
};

export const emptyPollenActivity = Object.fromEntries(
  allergenIds.map((allergenId) => [allergenId, "unknown"]),
) as PollenActivityByAllergen;

export const idleCurrentPollenState: CurrentPollenState = {
  pollenActivity: emptyPollenActivity,
  status: "idle",
  message: "",
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function createCurrentPollenLookup({
  fetchCurrentPollen,
  createAbortController = () => new AbortController(),
  onState,
  unavailableMessage,
}: CurrentPollenLookupOptions) {
  let activePlaceId: string | null = null;
  let controller: AbortController | null = null;

  function setCity(city: CitySuggestion | null) {
    controller?.abort();
    controller = null;
    activePlaceId = city?.placeId ?? null;

    if (!city) {
      onState(idleCurrentPollenState);
      return;
    }

    const placeId = city.placeId;
    controller = createAbortController();
    onState({
      pollenActivity: emptyPollenActivity,
      status: "loading",
      message: "",
    });

    fetchCurrentPollen("/api/current-pollen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as CurrentPollenResponse;

        if (activePlaceId !== placeId) {
          return;
        }

        onState({
          pollenActivity: payload.pollenActivity,
          status: payload.status === "ok" ? "idle" : "unavailable",
          message: payload.message ?? "",
        });
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || activePlaceId !== placeId) {
          return;
        }

        onState({
          pollenActivity: emptyPollenActivity,
          status: "unavailable",
          message: unavailableMessage,
        });
      });
  }

  function dispose() {
    controller?.abort();
    controller = null;
    activePlaceId = null;
  }

  return { setCity, dispose };
}
