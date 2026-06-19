// risk: context/changes/cohesive-ui-ux-polish/plan.md manual UI verification
// seed: role-based locators, independent setup, waits for state, risk-tied assertions
import { expect, test } from "@playwright/test";

import { chooseCity, mockCitySearch, mockUnknownPollen } from "./fixtures";

test("guest current check keeps missing pollen warning visible and save explicit", async ({ page }) => {
  await mockCitySearch(page);
  await mockUnknownPollen(
    page,
    "Aktualne dane pyłkowe są chwilowo niedostępne.",
  );

  // Open the public current-check flow.
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Sprawdź, które pyłki mogą dziś pasować do Twoich objawów",
    }),
  ).toBeVisible();

  // Complete a city and one symptom so results render against unknown pollen.
  await chooseCity(page, "Aktualne miasto", "Kra");
  await page.getByRole("checkbox", { name: "Kichanie" }).check();
  await page.getByText("Wysokie").click();
  await expect(page.getByRole("radio", { name: "Wysokie" })).toBeChecked();

  // Assert the user-visible warning and ranking outcome, not implementation details.
  await expect(
    page.getByText("Aktualne dane pyłkowe są chwilowo niedostępne."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pyłki traw" }),
  ).toBeVisible();
  await expect(page.getByText("Aktywność pyłków: Brak danych")).toHaveCount(4);

  // Saving remains an explicit action and unauthenticated users are handed to login.
  await expect(
    page.getByText("Zapis nastąpi tylko po wybraniu tego przycisku i zalogowaniu się."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zapisz sprawdzenie" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole("heading", { name: "Zaloguj się" })).toBeVisible();
});
