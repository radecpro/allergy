// risk: context/foundation/test-plan.md #5 — missing pollen data loses visible warning
// seed: tests/e2e/seed.spec.ts
import { expect, test } from "@playwright/test";

import { chooseCity, mockCitySearch, mockUnknownPollen } from "./fixtures";

test.describe("Cohesive UI and UX Polish", () => {
  test("destination flow keeps unavailable pollen warning visible while showing all groups", async ({ page }) => {
    await mockCitySearch(page);
    await mockUnknownPollen(
      page,
      "Dane o aktywności pyłków dla miejsca docelowego są chwilowo niedostępne.",
    );

    // Open the public destination flow.
    await page.goto("/destination");
    await expect(
      page.getByRole("heading", { name: "Sprawdź aktywność pyłków przed podróżą" }),
    ).toBeVisible();

    // Select a destination city through the accessible combobox.
    await chooseCity(page, "Miasto docelowe", "War");

    // The warning stays first-glance visible and groups are not suppressed.
    await expect(
      page.getByText(
        "Dane o aktywności pyłków dla miejsca docelowego są chwilowo niedostępne.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pyłki traw" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pyłki drzew" })).toBeVisible();
    await expect(page.getByText("Aktywność pyłków: Brak danych")).toHaveCount(4);
  });
});
