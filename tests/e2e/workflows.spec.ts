import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toBeVisible();
});

test("tableau de bord, recherche, thèmes et navigation responsive", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByText("ESPACE DE DÉMONSTRATION", { exact: true }),
  ).toBeVisible();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/tableau-de-bord.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Activer le mode sombre" }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.screenshot({
    path: "docs/screenshots/tableau-de-bord-sombre.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Activer le mode clair" }).click();
  await page
    .getByRole("textbox", { name: "Rechercher dans les dossiers" })
    .fill("DEMO-001");
  await page
    .locator(".search-results")
    .getByRole("button", { name: /DEMO-001/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Prix de vente (€)")).toHaveValue(
    /429000(?:\.00)?/,
  );
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 1024);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  expect(errors).toEqual([]);
});

test("création vendeur, mandat, modification et persistance après reconnexion", async ({
  page,
}) => {
  const suffix = Date.now();
  await page.getByRole("button", { name: "Vendeurs", exact: true }).click();
  await page.getByRole("button", { name: "Nouveau contact" }).click();
  await page.getByLabel("Nom complet").fill(`Vendeur E2E ${suffix}`);
  await page.getByLabel("E-mail", { exact: true }).fill("e2e@example.com");
  await page.getByLabel("Commune", { exact: true }).fill("Annecy");
  await page.getByRole("button", { name: "Enregistrer le contact" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText(`Vendeur E2E ${suffix}`, { exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: /^Mandats/ })
    .click();
  await page.getByRole("button", { name: "Nouveau mandat" }).click();
  await page.getByLabel("Référence").fill(`E2E-${suffix}`);
  await page
    .getByLabel("Vendeur *", { exact: true })
    .selectOption({ label: `Vendeur E2E ${suffix}` });
  await page.getByLabel("Intitulé du bien").fill("T3 E2E avec terrasse");
  await page.getByLabel("Adresse du bien").fill("1 rue de test");
  await page.getByLabel("Surface (m²)").fill("75");
  await page.getByLabel("Nombre de pièces").fill("3");
  await page.getByLabel("Prix de vente (€)").fill("450000");
  await page.getByLabel("Date d’échéance").fill("2027-12-31");
  await page.getByLabel("Statut *", { exact: true }).selectOption("active");
  await page.getByRole("button", { name: "Enregistrer le mandat" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Filtrer la liste" })
    .fill(`E2E-${suffix}`);
  await page.getByRole("button", { name: "Ouvrir", exact: true }).click();
  await page.getByLabel("Prix de vente (€)").fill("440000");
  await page.getByRole("button", { name: "Enregistrer le mandat" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("440 000 €", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: /^Mandats/ })
    .click();
  await page
    .getByRole("textbox", { name: "Filtrer la liste" })
    .fill(`E2E-${suffix}`);
  await expect(
    page.getByText("T3 E2E avec terrasse", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("440 000 €", { exact: true })).toBeVisible();
});

test("critères acquéreurs, document lié, téléchargement et arrêt des automatisations", async ({
  page,
}) => {
  await page
    .locator("nav")
    .getByRole("button", { name: "Acquéreurs", exact: true })
    .click();
  await page.getByRole("button", { name: "Nouveau contact" }).click();
  await page.getByLabel("Nom complet").fill("Acquéreur E2E");
  await page.getByLabel("Budget minimum").fill("200000");
  await page.getByLabel("Budget maximum").fill("400000");
  await page.getByLabel("Secteurs recherchés").fill("Annecy, Sevrier");
  await page.getByRole("button", { name: "Enregistrer le contact" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("400 000 €", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter un document" }).click();
  await page.getByLabel("Fichier").setInputFiles({
    name: "diagnostic-test.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nfixture\n%%EOF"),
  });
  await page
    .getByLabel("Contact associé")
    .selectOption({ label: "Acquéreur E2E" });
  await page.getByRole("button", { name: "Importer le document" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger" }).click();
  expect((await download).suggestedFilename()).toBe("diagnostic-test.pdf");
  await page.getByRole("button", { name: "Paramètres", exact: true }).click();
  await page
    .getByRole("button", { name: "Arrêter les automatisations" })
    .click();
  await expect(
    page.getByText("Automatisations arrêtées", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Réactiver la préférence" }).click();
  await expect(page.getByText("Préférence générale activée")).toBeVisible();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(
    page.getByRole("heading", { name: "Bienvenue dans votre espace." }),
  ).toBeVisible();
});
