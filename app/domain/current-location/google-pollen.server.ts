import type {
  AllergenId,
  PollenActivityByAllergen,
  PollenActivityLevel,
} from "~/domain/allergen-ranking";
import { allergenIds } from "~/domain/allergen-ranking";
import { getGoogleMapsProviderConfig } from "~/domain/google-maps/config.server";
import { currentLocationRequestGuards } from "./http";
import type { PollenLookupResult, SelectedCity } from "./types";

type GooglePollenIndexInfo = {
  value?: number;
};

type GooglePollenResponse = {
  dailyInfo?: Array<{
    pollenTypeInfo?: Array<{
      code?: string;
      indexInfo?: GooglePollenIndexInfo;
    }>;
    plantInfo?: Array<{
      code?: string;
      indexInfo?: GooglePollenIndexInfo;
    }>;
  }>;
};

const pollenTypeAllergenMap = {
  GRASS: "grass-pollen",
  TREE: "tree-pollen",
  WEED: "weed-pollen",
} as const satisfies Record<string, AllergenId>;

const ragweedPlantCodes = new Set(["RAGWEED"]);

function getAllergenForPollenType(code: string | undefined): AllergenId | undefined {
  if (code === "GRASS" || code === "TREE" || code === "WEED") {
    return pollenTypeAllergenMap[code];
  }

  return undefined;
}

export function createUnknownPollenActivity(): PollenActivityByAllergen {
  return Object.fromEntries(
    allergenIds.map((allergenId) => [allergenId, "unknown"]),
  ) as PollenActivityByAllergen;
}

export function normalizeGooglePollenIndex(value: number | undefined): PollenActivityLevel {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "unknown";
  }

  if (value >= 4) {
    return "very-high";
  }

  if (value >= 3) {
    return "high";
  }

  if (value >= 2) {
    return "moderate";
  }

  return "low";
}

export function normalizeGooglePollenForecast(
  payload: GooglePollenResponse,
): PollenActivityByAllergen {
  const activity = createUnknownPollenActivity();
  const today = payload.dailyInfo?.[0];

  for (const pollenType of today?.pollenTypeInfo ?? []) {
    const allergenId = getAllergenForPollenType(pollenType.code);

    if (allergenId) {
      activity[allergenId] = normalizeGooglePollenIndex(pollenType.indexInfo?.value);
    }
  }

  for (const plant of today?.plantInfo ?? []) {
    if (ragweedPlantCodes.has(plant.code ?? "")) {
      activity["ragweed-pollen"] = normalizeGooglePollenIndex(plant.indexInfo?.value);
    }
  }

  return activity;
}

function hasUsableMappedPollenIndex(payload: GooglePollenResponse): boolean {
  const today = payload.dailyInfo?.[0];

  for (const pollenType of today?.pollenTypeInfo ?? []) {
    if (
      getAllergenForPollenType(pollenType.code) &&
      typeof pollenType.indexInfo?.value === "number" &&
      Number.isFinite(pollenType.indexInfo.value)
    ) {
      return true;
    }
  }

  for (const plant of today?.plantInfo ?? []) {
    if (
      ragweedPlantCodes.has(plant.code ?? "") &&
      typeof plant.indexInfo?.value === "number" &&
      Number.isFinite(plant.indexInfo.value)
    ) {
      return true;
    }
  }

  return false;
}

export async function lookupGooglePollen(city: Pick<SelectedCity, "latitude" | "longitude">): Promise<PollenLookupResult> {
  const configResult = getGoogleMapsProviderConfig();

  if (!configResult.ok) {
    return {
      status: configResult.error.status,
      pollenActivity: createUnknownPollenActivity(),
      message: configResult.error.message,
    };
  }

  const url = new URL(configResult.config.pollenForecastUrl);
  url.searchParams.set("key", configResult.config.apiKey);
  url.searchParams.set("location.latitude", String(city.latitude));
  url.searchParams.set("location.longitude", String(city.longitude));
  url.searchParams.set("days", "1");
  url.searchParams.set("languageCode", "pl");

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    currentLocationRequestGuards.providerTimeoutMs,
  );

  try {
    const response = await fetch(url, { signal: abortController.signal });

    if (!response.ok) {
      return {
        status: "provider-unavailable",
        pollenActivity: createUnknownPollenActivity(),
        message: "Aktualne dane pylenia są chwilowo niedostępne.",
      };
    }

    const payload = (await response.json()) as GooglePollenResponse;
    const pollenActivity = normalizeGooglePollenForecast(payload);

    if (!hasUsableMappedPollenIndex(payload)) {
      return {
        status: "not-found",
        pollenActivity,
        message: "Brak aktualnych danych pylenia dla wybranej lokalizacji.",
      };
    }

    return {
      status: "ok",
      pollenActivity,
    };
  } catch {
    return {
      status: "provider-unavailable",
      pollenActivity: createUnknownPollenActivity(),
      message: "Aktualne dane pylenia są chwilowo niedostępne.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
