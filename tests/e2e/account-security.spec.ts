import { test, expect } from "@playwright/test";

test("la démonstration distingue les identifiants du compte privé", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /démonstration/i }).click();
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Paramètres", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sécurité de mon compte", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "La gestion des identifiants est disponible dans votre espace personnel.",
      { exact: true },
    ),
  ).toBeVisible();
});
