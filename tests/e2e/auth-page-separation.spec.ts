// risk: context/changes/cohesive-ui-ux-polish/plan.md phase 1 manual — auth stays separate from product shell
// seed: tests/e2e/seed.spec.ts
import { expect, test } from "@playwright/test";

test.describe("Cohesive UI and UX Polish", () => {
  test("auth pages stay focused instead of using the product shell", async ({ page }) => {
    // Open the login surface directly.
    await page.goto("/login");

    // Auth keeps its focused form and route back to the guest flow.
    await expect(page.getByRole("heading", { name: "Zaloguj się" })).toBeVisible();
    await expect(page.getByLabel("Adres e-mail")).toBeVisible();
    await expect(page.getByLabel("Hasło")).toBeVisible();
    await expect(page.getByRole("link", { name: "Wróć do testu gościnnego" })).toBeVisible();

    // Product-shell navigation is intentionally absent on auth pages.
    await expect(
      page.getByRole("navigation", { name: "Tryb sprawdzania alergii" }),
    ).toBeHidden();
    await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeHidden();
  });
});
