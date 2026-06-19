// risk: context/changes/cohesive-ui-ux-polish/plan.md phases 1 and 4 manual — cohesive shell and transition polish
// seed: tests/e2e/seed.spec.ts
import { expect, test } from "@playwright/test";

import { mockCitySearch, mockMixedPollen } from "./fixtures";

test.describe("Cohesive UI and UX Polish", () => {
  test("current and destination flows share shell navigation and transition-ready controls", async ({ page }) => {
    await mockCitySearch(page);
    await mockMixedPollen(page);

    // Current-check route exposes the shared product shell.
    await page.goto("/");
    await expect(page.getByText("Allergen Finder").first()).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Tryb sprawdzania alergii" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Aktualne objawy" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Podróż" })).toBeVisible();

    // Interactive controls have transition/focus styling without changing user semantics.
    const destinationMode = page.getByRole("link", { name: "Podróż" });
    const saveButton = page.getByRole("button", { name: "Zapisz sprawdzenie" });
    await expect(destinationMode).toHaveCSS("transition-duration", "0.15s");
    await expect(saveButton).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: "Kichanie" })).toBeVisible();

    // Destination route keeps the same shell and mode switch.
    await destinationMode.click();
    await expect(page).toHaveURL("/destination");
    await expect(
      page.getByRole("heading", { name: "Sprawdź aktywność pyłków przed podróżą" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Tryb sprawdzania alergii" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Aktualne objawy" })).toBeVisible();
  });
});
