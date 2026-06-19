import { expect, type Page, type Route } from "@playwright/test";

type PollenLevel = "unknown" | "low" | "moderate" | "high" | "very-high";

type CityFixture = {
  adminArea?: string;
  country: string;
  label: string;
  mainText: string;
  placeId: string;
  secondaryText: string;
};

const cityFixtures: Record<string, CityFixture> = {
  krakow: {
    adminArea: "małopolskie",
    country: "Polska",
    label: "Kraków, Polska",
    mainText: "Kraków",
    placeId: "place_krakow",
    secondaryText: "Polska",
  },
  warsaw: {
    adminArea: "mazowieckie",
    country: "Polska",
    label: "Warszawa, Polska",
    mainText: "Warszawa",
    placeId: "place_warsaw",
    secondaryText: "Polska",
  },
};

const unknownPollenActivity = {
  "grass-pollen": "unknown",
  "tree-pollen": "unknown",
  "weed-pollen": "unknown",
  "ragweed-pollen": "unknown",
} satisfies Record<string, PollenLevel>;

const mixedPollenActivity = {
  "grass-pollen": "high",
  "tree-pollen": "moderate",
  "weed-pollen": "low",
  "ragweed-pollen": "unknown",
} satisfies Record<string, PollenLevel>;

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  });
}

export async function mockCitySearch(page: Page) {
  await page.route("**/api/city-search", async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as { query?: string };
    const query = payload.query?.toLocaleLowerCase("pl-PL") ?? "";
    const suggestions = query.includes("war")
      ? [cityFixtures.warsaw]
      : query.includes("kra")
        ? [cityFixtures.krakow]
        : [];

    await fulfillJson(route, {
      status: suggestions.length > 0 ? "ok" : "empty",
      suggestions,
    });
  });
}

export async function mockUnknownPollen(page: Page, message: string) {
  await page.route("**/api/current-pollen", async (route) => {
    await fulfillJson(route, {
      status: "unavailable",
      pollenActivity: unknownPollenActivity,
      message,
    });
  });
}

export async function mockMixedPollen(page: Page) {
  await page.route("**/api/current-pollen", async (route) => {
    await fulfillJson(route, {
      status: "ok",
      pollenActivity: mixedPollenActivity,
    });
  });
}

export async function chooseCity(page: Page, fieldName: string, cityPrefix: string) {
  const cityField = page.getByRole("combobox", { name: fieldName });
  const cityOption = page.getByRole("option", {
    name: new RegExp(cityPrefix, "i"),
  });

  await cityField.fill(cityPrefix);
  await expect(cityOption).toBeVisible();
  await cityOption.click();
}
