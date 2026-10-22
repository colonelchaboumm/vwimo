import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

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

test("transaction, barème, validation explicite et encaissements au centime", async ({
  page,
}) => {
  await nav(page, "Transactions");
  await page
    .getByRole("button", { name: "Nouvelle transaction", exact: true })
    .click();
  await page
    .getByLabel("Référence de transaction", { exact: true })
    .fill("VENTE-E2E");
  const mandate = page.getByLabel("Mandat de la transaction", { exact: true });
  await mandate.selectOption({ index: 1 });
  await page
    .getByLabel("Prix de vente retenu (€)", { exact: true })
    .fill("345678.90");
  await page
    .getByLabel("Notaire / étude", { exact: true })
    .fill("Étude de test");
  await page
    .getByRole("button", { name: "Enregistrer la transaction", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const transaction = page.locator("article").filter({ hasText: "VENTE-E2E" });
  await expect(transaction).toContainText(
    "345 678,90".replaceAll(" ", "\u202f"),
  );
  await transaction
    .getByRole("button", { name: "Documents du dossier" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Documents · VENTE-E2E");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/transactions.png",
    fullPage: true,
  });

  await nav(page, "Commissions & revenus");
  await page
    .getByRole("button", { name: "Barèmes contractuels", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nouveau barème", exact: true })
    .click();
  await page
    .getByLabel("Nom du barème", { exact: true })
    .fill("Barème fictif E2E");
  await page
    .getByLabel("Partenaire du contrat", { exact: true })
    .fill("Partenaire fictif E2E");
  await page
    .getByLabel("Assiette prévue au contrat", { exact: true })
    .fill("Assiette fictive de test");
  await page.getByLabel("Taux (%) · palier 1", { exact: true }).fill("12.5");
  await page
    .getByRole("button", { name: "Enregistrer le barème", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Revenus & encaissements", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nouveau revenu", exact: true })
    .click();
  await page.getByLabel("Référence du revenu", { exact: true }).fill("REV-E2E");
  await page
    .getByLabel("Libellé du revenu", { exact: true })
    .fill("Commission déménagement E2E");
  await page
    .getByLabel("Origine de la rémunération", { exact: true })
    .selectOption("moving");
  await page
    .getByLabel("Calcul de la rémunération", { exact: true })
    .selectOption({ label: "Barème fictif E2E · Partenaire fictif E2E" });
  await page
    .getByLabel("Assiette de l’opération (€)", { exact: true })
    .fill("1000.20");
  const linked = page.getByLabel("Transaction liée (facultatif)", {
    exact: true,
  });
  await linked.selectOption(
    (await linked
      .locator("option")
      .filter({ hasText: "VENTE-E2E" })
      .getAttribute("value")) as string,
  );
  await page
    .getByLabel("Justification du droit à rémunération", { exact: true })
    .fill("Contrat fictif et prestation confirmée pour le test.");
  await page
    .getByRole("button", { name: "Enregistrer la prévision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const card = page.locator("article").filter({ hasText: "REV-E2E" });
  await expect(card).toContainText("125,03");
  await card
    .getByRole("button", { name: "Calcul et encaissements", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Recalculer avant validation", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", {
      name: "Confirmer le revenu validé",
      exact: true,
    }),
  ).toBeDisabled();
  await dialog
    .getByRole("checkbox", {
      name: "Je confirme ce calcul et mon droit à rémunération à cette date.",
      exact: true,
    })
    .check();
  await dialog
    .getByRole("button", { name: "Confirmer le revenu validé", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Revenu validé");
  await dialog
    .getByLabel("Montant encaissé (€)", { exact: true })
    .fill("50.01");
  await dialog
    .getByLabel("Référence / preuve de l’encaissement", { exact: true })
    .fill("Virement fictif E2E");
  await dialog
    .getByRole("button", {
      name: "Enregistrer l’encaissement déclaré",
      exact: true,
    })
    .click();
  await expect(dialog.locator(".finance-payments li")).toHaveCount(1);
  await expect(dialog.locator(".prospect-stats")).toContainText("75,02");
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await card
    .getByRole("button", { name: "Calcul et encaissements", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.locator(".finance-payments li")).toHaveCount(1);
  await dialog
    .getByLabel("Montant encaissé (€)", { exact: true })
    .fill("75.02");
  await dialog
    .getByLabel("Référence / preuve de l’encaissement", { exact: true })
    .fill("Solde fictif E2E");
  await dialog
    .getByRole("button", {
      name: "Enregistrer l’encaissement déclaré",
      exact: true,
    })
    .click();
  await expect(dialog.locator(".finance-payments li")).toHaveCount(2);
  await expect(
    dialog.getByLabel("Montant encaissé (€)", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "docs/screenshots/commissions-encaissements.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exporter les revenus CSV", exact: true })
    .click();
  const csv = await download;
  const content = await readFile((await csv.path())!, "utf8");
  expect(content).toContain("REV-E2E");
  expect(content).toContain("125.03");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/commissions.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(card).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await card
    .getByRole("button", { name: "Calcul et encaissements", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".finance-payments li"),
  ).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/finance-mobile.png",
    fullPage: true,
  });
});
