import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function nav(page: Page, name: string) {
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toBeVisible();
});
test("partenaire, autorisation, historique et revenu lié sans double comptage", async ({
  page,
}) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  await nav(page, "Courtage & recommandations");
  await page
    .getByRole("button", { name: "Annuaire partenaires", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nouveau partenaire", exact: true })
    .click();
  await page
    .getByLabel("Nom / société du partenaire", { exact: true })
    .fill("Courtier fictif E2E");
  await page
    .getByLabel("E-mail du partenaire", { exact: true })
    .fill("courtier-e2e@example.com");
  await page
    .getByLabel("Accord / conditions du partenariat", { exact: true })
    .fill("Accord fictif de test à vérifier.");
  await page
    .getByRole("button", { name: "Enregistrer le partenaire", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const partner = page
    .locator("article")
    .filter({ hasText: "Courtier fictif E2E" });
  await partner
    .getByRole("button", { name: "Créer une mise en relation", exact: true })
    .click();
  await page
    .getByLabel("Référence du dossier partenaire", { exact: true })
    .fill("APP-E2E");
  await page
    .getByLabel("Libellé de la mise en relation", { exact: true })
    .fill("Financement fictif E2E");
  const contact = page.getByLabel("Contact recommandé / acquéreur", {
    exact: true,
  });
  await contact.selectOption({ label: "Julie Dubois" });
  await page
    .getByLabel("Origine de la recommandation", { exact: true })
    .fill("Demande fictive E2E");
  await page
    .getByLabel("Projet / besoin du client", { exact: true })
    .fill("Projet de financement fictif");
  await page
    .getByLabel("Étape du dossier partenaire", { exact: true })
    .selectOption("introduced");
  await page
    .getByLabel("Date de mise en relation effectuée", { exact: true })
    .fill(today);
  await page
    .getByRole("button", {
      name: "Enregistrer le dossier partenaire",
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText("autorisation client");
  await expect(
    page.getByLabel("Référence du dossier partenaire", { exact: true }),
  ).toHaveValue("APP-E2E");
  await page
    .getByLabel("Autorisation du client", { exact: true })
    .selectOption("granted");
  await page
    .getByLabel("Date d’autorisation / refus / retrait", { exact: true })
    .fill(today);
  await page
    .getByLabel("Justificatif déclaré de l’autorisation / refus / retrait", {
      exact: true,
    })
    .fill("Accord fictif du client pour le test.");
  await page
    .getByRole("button", {
      name: "Enregistrer le dossier partenaire",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mises en relation", exact: true })
    .click();
  await page
    .getByLabel("Rechercher un dossier partenaire", { exact: true })
    .fill("APP-E2E");
  const card = page.locator("article").filter({ hasText: "APP-E2E" });
  await card
    .getByRole("button", { name: "Modifier la mise en relation", exact: true })
    .click();
  await expect(
    page.getByLabel("Contact recommandé / acquéreur", { exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Autorisation du client", { exact: true })
    .selectOption("withdrawn");
  await page
    .getByLabel("Justificatif déclaré de l’autorisation / refus / retrait", {
      exact: true,
    })
    .fill("Retrait fictif du client après transmission.");
  await page
    .getByRole("button", {
      name: "Enregistrer le dossier partenaire",
      exact: true,
    })
    .click();
  await expect(card).toContainText("Autorisation retirée");
  await card
    .getByRole("button", { name: "Historique et revenus", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.locator(".partner-history li")).toHaveCount(2);
  await expect(dialog.locator(".finance-calculation")).toContainText(
    "Accord fictif du client pour le test.",
  );
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/partenaires.png",
    fullPage: true,
  });

  await nav(page, "Commissions & revenus");
  await page
    .getByRole("button", { name: "Nouveau revenu", exact: true })
    .click();
  await page
    .getByLabel("Référence du revenu", { exact: true })
    .fill("REV-PARTENAIRE-E2E");
  await page
    .getByLabel("Libellé du revenu", { exact: true })
    .fill("Rémunération fictive partenaire");
  await page
    .getByLabel("Origine de la rémunération", { exact: true })
    .selectOption("broker");
  await page
    .getByLabel("Payeur / partenaire", { exact: true })
    .fill("Courtier fictif E2E");
  await page
    .getByLabel("Montant fixe de rémunération (€)", { exact: true })
    .fill("98.76");
  await page
    .getByLabel("Dossier de mise en relation lié (facultatif)", { exact: true })
    .selectOption({ label: "APP-E2E · Financement fictif E2E" });
  await page
    .getByRole("button", { name: "Enregistrer la prévision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "Courtage & recommandations");
  await page
    .getByLabel("Rechercher un dossier partenaire", { exact: true })
    .fill("APP-E2E");
  await card
    .getByRole("button", { name: "Historique et revenus", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.locator(".finance-payments li")).toHaveCount(1);
  await expect(dialog.locator(".finance-payments")).toContainText("98,76");
  await page.screenshot({
    path: "docs/screenshots/recommandation-historique.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await nav(page, "Statistiques");
  await expect(
    page.getByRole("heading", {
      name: "Vos chiffres, en perspective.",
      exact: true,
    }),
  ).toBeVisible();
  const row = page
    .getByRole("region", { name: "Revenus par origine", exact: true })
    .getByRole("row")
    .filter({ hasText: "Courtier" });
  await expect(row).toContainText("98,76");
  await page.screenshot({
    path: "docs/screenshots/pilotage-annuel.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/pilotage-mobile.png",
    fullPage: true,
  });
});

test("partenaires et pilotage lisibles avec un profil lecteur", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await page.route("**/api/auth/demo", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.user.role = "reader";
    await route.fulfill({ response, json: data });
  });
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await nav(page, "Courtage & recommandations");
  await expect(
    page.getByRole("button", {
      name: "Nouveau dossier partenaire",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Annuaire partenaires", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Nouveau partenaire", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Fiche partenaire", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog").locator("input")).toHaveCount(0);
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await nav(page, "Statistiques");
  await expect(
    page.getByRole("region", { name: "Revenus mensuels", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Nature des montants", { exact: true })
    .selectOption("ht");
  await expect(page.getByRole("table").first()).toContainText("HT déclaré");
});
